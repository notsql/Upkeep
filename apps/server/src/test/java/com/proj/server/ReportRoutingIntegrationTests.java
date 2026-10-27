package com.proj.server;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.endsWith;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.proj.server.resident.ResidentImageStore;
import com.proj.server.resident.ResidentReportException;
import com.proj.server.routing.Classification;
import com.proj.server.routing.ClassificationFailedException;
import com.proj.server.routing.DispatchDeliveryJob;
import com.proj.server.routing.FaultClassifier;
import com.proj.server.routing.ReportClassificationJob;
import com.proj.server.routing.WorkOrderEmail;
import com.proj.server.routing.WorkOrderEmailSender;
import com.proj.server.routing.WorkOrderSendException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Executable contract for ID-70 as revised to build on ID-36 work orders
 * (.spec/features/equipment-fault-work-orders.md).
 */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
            "app.routing.initial-delay=PT1H"
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ReportRoutingIntegrationTests {
    private static final String MODEL = "claude-haiku-5-5";
    private static final String SYSTEM = "system:report-routing";

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @Autowired
    ReportClassificationJob classification;

    @Autowired
    DispatchDeliveryJob delivery;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    ResidentImageStore imageStore;

    @MockitoBean
    FaultClassifier classifier;

    @MockitoBean
    WorkOrderEmailSender sender;

    @MockitoBean
    com.proj.server.workos.WorkOSService workOS;

    @BeforeEach
    void modelIsConfigured() {
        when(classifier.available()).thenReturn(true);
    }

    // --- Contractors are service providers routed per equipment type -------------------------------------------

    @Test
    void aManagerSavesReplacesListsAndRemovesContractorsPerEquipmentType() throws Exception {
        var estate = estate();

        mvc.perform(as("estate-owner", get(contractors(estate))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(saveContractor(estate, "LIFT", "  Acme Lifts  ", "faults@acmelifts.example"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.equipmentType").value("LIFT"))
                .andExpect(jsonPath("$.name").value("Acme Lifts"))
                .andExpect(jsonPath("$.email").value("faults@acmelifts.example"));
        mvc.perform(saveContractor(estate, "PUMP", "Pump Co", "pumps@example.com"))
                .andExpect(status().isOk());
        mvc.perform(saveContractor(estate, "LIFT", "Better Lifts", "jobs@betterlifts.example"))
                .andExpect(status().isOk());

        mvc.perform(as("estate-owner", get(contractors(estate))))
                .andExpect(jsonPath("$[*].equipmentType", contains("PUMP", "LIFT")))
                .andExpect(jsonPath("$[1].email").value("jobs@betterlifts.example"));

        mvc.perform(as("estate-owner", delete(contractors(estate) + "/PUMP"))).andExpect(status().isNoContent());
        mvc.perform(as("estate-owner", delete(contractors(estate) + "/PUMP"))).andExpect(status().isNoContent());
        mvc.perform(as("estate-owner", get(contractors(estate))))
                .andExpect(jsonPath("$[*].equipmentType", contains("LIFT")));
        assertEquals(3, count("ServiceProvider", estate), "removing a route keeps its provider");
    }

    @Test
    void oneFirmServingSeveralTypesIsOneProvider() throws Exception {
        var estate = estate();

        mvc.perform(saveContractor(estate, "PUMP", "Fixit", "jobs@fixit.example"))
                .andExpect(status().isOk());
        mvc.perform(saveContractor(estate, "GATE", "Fixit Services", "jobs@fixit.example"))
                .andExpect(status().isOk());

        assertEquals(1, count("ServiceProvider", estate));
        assertEquals(2, count("EquipmentProviderRoute", estate));
        mvc.perform(as("estate-owner", get(contractors(estate))))
                .andExpect(jsonPath("$[0].name").value("Fixit Services"))
                .andExpect(jsonPath("$[1].name").value("Fixit Services"));
    }

    @ParameterizedTest
    @CsvSource(
            delimiter = '|',
            value = {
                "LIFT | '' | faults@acmelifts.example",
                "LIFT | '   ' | faults@acmelifts.example",
                "LIFT | Acme | not-an-email",
                "LIFT | Acme | ''",
                "LIFT | Acme | \"faults@acme.example\\r\\nBcc: x@example.com\"",
                "ESCALATOR | Acme | faults@acmelifts.example"
            })
    void contractorDetailsAreValidated(String type, String name, String email) throws Exception {
        var estate = estate();

        mvc.perform(saveContractor(estate, type, name, email)).andExpect(status().isBadRequest());
        assertEquals(0, count("ServiceProvider", estate));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "COUNCIL", "RESIDENT", "MEMBER"})
    void onlyWorkOrderCreatorsCanReadOrChangeContractors(String role) throws Exception {
        var estate = estate();
        member(estate, "staff", role);
        contractor(estate, "LIFT");

        mvc.perform(as("staff", get(contractors(estate)))).andExpect(status().isForbidden());
        mvc.perform(as(
                        "staff",
                        put(contractors(estate) + "/LIFT")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"X\",\"email\":\"x@example.com\"}")))
                .andExpect(status().isForbidden());
        mvc.perform(as("staff", delete(contractors(estate) + "/LIFT"))).andExpect(status().isForbidden());
        assertEquals(1, count("EquipmentProviderRoute", estate));
    }

    @Test
    void contractorsOfAnEstateYouDoNotBelongToAreHidden() throws Exception {
        mvc.perform(as("stranger", get(contractors(estate())))).andExpect(status().isNotFound());
    }

    // --- Classification ----------------------------------------------------------------------------------------

    @Test
    void submittingAReportQueuesItForClassificationAndResidentsNeverSeeRouting() throws Exception {
        var estate = estate();
        member(estate, "resident-a", "RESIDENT");
        var level = level(estate);

        var response = mvc.perform(multipart("/resident/reports")
                        .param("title", "Lift stuck")
                        .param("description", "Doors won't open")
                        .param("locationId", level.toString())
                        .param("estateId", estate.toString())
                        .with(identity("resident-a")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.routing").doesNotExist())
                .andReturn();
        var report = UUID.fromString(JsonPath.read(response.getResponse().getContentAsString(), "$.id"));

        assertEquals("CLASSIFYING", routing(report).get("state"));
        assertEquals(estate, routing(report).get("estateId"));
        mvc.perform(as("resident-a", get("/resident/reports/" + report)))
                .andExpect(jsonPath("$.routing").doesNotExist());
    }

    @Test
    void aConfidentRoutableFaultBecomesAnAssignedWorkOrderWithAContractorEmail() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var report = queuedReport(estate);
        image(report, new byte[] {9, 9});
        when(imageStore.read(any())).thenReturn(new byte[] {9, 9});
        when(classifier.classify(any()))
                .thenReturn(Classification.of("EQUIPMENT_FAULT", "LIFT", 0.92, "Lift doors stuck", MODEL));

        assertTrue(classification.classifyNext());

        var input = ArgumentCaptor.forClass(FaultClassifier.Report.class);
        verify(classifier).classify(input.capture());
        assertEquals("Block A › Level 4", input.getValue().locationLabel());
        assertArrayEquals(
                new byte[] {9, 9}, input.getValue().images().getFirst().bytes());
        assertFalse(input.getValue().toString().contains("resident-a"));

        var order = workOrderFor(report);
        assertEquals("EQUIPMENT_FAULT", order.get("category"));
        assertEquals("MEDIUM", order.get("priority"));
        assertEquals("RESIDENT_REPORT", order.get("source"));
        assertEquals(report, order.get("sourceReportId"));
        assertEquals("Doors won't open at level 3", order.get("description"));
        assertEquals(locationOf(report), order.get("locationId"));
        assertNull(order.get("assetId"));
        assertEquals(SYSTEM, order.get("createdByUserId"));
        assertEquals("ASSIGNED", order.get("status"));
        assertEquals(1, order.get("version"));
        assertEquals(List.of("OPEN", "ASSIGNED"), statusHistory((UUID) order.get("id")));
        assertEquals(SYSTEM, lastStatusChanger((UUID) order.get("id")));
        assertTrue(((String) order.get("reference")).endsWith("-W0001"));

        var dispatch = dispatchFor((UUID) order.get("id"));
        assertEquals("PENDING", dispatch.get("status"));
        assertEquals("Acme LIFT", dispatch.get("contractorName"));
        assertEquals("lift@contractor.example", dispatch.get("contractorEmail"));
        assertNull(dispatch.get("approvedByUserId"));
        assertEquals(provider(estate, "lift@contractor.example"), dispatch.get("providerId"));

        var row = routing(report);
        assertEquals("WORK_ORDER", row.get("state"));
        assertEquals(order.get("id"), row.get("workOrderId"));
        assertFalse(classification.classifyNext());

        mvc.perform(as("estate-owner", get(detail(estate, report))))
                .andExpect(jsonPath("$.routing.state").value("WORK_ORDER"))
                .andExpect(jsonPath("$.routing.classification.confidence").value(0.92))
                .andExpect(
                        jsonPath("$.routing.workOrder.id").value(order.get("id").toString()))
                .andExpect(jsonPath("$.routing.workOrder.reference").value(endsWith("-W0001")))
                .andExpect(jsonPath("$.routing.workOrder.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.routing.workOrder.dispatch.approval").value("AUTOMATIC"))
                .andExpect(jsonPath("$.routing.workOrder.dispatch.status").value("PENDING"));
        mvc.perform(as("estate-owner", get(workOrders(estate) + "/" + order.get("id"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdByUserId").value(SYSTEM))
                .andExpect(jsonPath("$.createdByName").value("Upkeep (automatic routing)"));
        verify(workOS, never()).findDisplayName(SYSTEM);
    }

    @ParameterizedTest
    @CsvSource(
            delimiter = '|',
            value = {
                "EQUIPMENT_FAULT | LIFT | 0.79 | LIFT | Confidence below threshold",
                "INCONCLUSIVE | LIFT | 0.95 | LIFT | Water near the lift lobby needs an on-site check",
                "NOT_EQUIPMENT | NONE | 0.99 | LIFT | Water near the lift lobby needs an on-site check",
                "EQUIPMENT_FAULT | GATE | 0.99 | LIFT | No GATE contractor configured"
            })
    void anythingLessThanAConfidentRoutableFaultGoesToReviewWithoutAWorkOrder(
            String outcome, String type, double confidence, String configured, String reason) throws Exception {
        var estate = estate();
        contractor(estate, configured);
        var report = queuedReport(estate);
        when(classifier.classify(any()))
                .thenReturn(Classification.of(
                        outcome, type, confidence, "Water near the lift lobby needs an on-site check", MODEL));

        assertTrue(classification.classifyNext());

        assertEquals("NEEDS_REVIEW", routing(report).get("state"));
        assertEquals(reason, routing(report).get("reason"));
        assertEquals(0, count("WorkOrder", estate));
    }

    @Test
    void aReportWhoseLocationIsNowInactiveGoesToReviewInsteadOfBecomingAWorkOrder() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var report = queuedReport(estate);
        db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", locationOf(report));
        when(classifier.classify(any()))
                .thenReturn(Classification.of("EQUIPMENT_FAULT", "LIFT", 0.95, "Lift doors stuck", MODEL));

        assertTrue(classification.classifyNext());

        assertEquals("NEEDS_REVIEW", routing(report).get("state"));
        assertEquals("The report's location is inactive", routing(report).get("reason"));
        assertEquals(0, count("WorkOrder", estate));
        assertEquals(1, count("ReportClassification", report, "reportId"));
    }

    @Test
    void failedAttemptsAreRetriedThenEscalatedAfterTheThird() throws Exception {
        var estate = estate();
        var report = queuedReport(estate);
        when(classifier.classify(any())).thenThrow(new ClassificationFailedException("timeout"));

        assertTrue(classification.classifyNext());
        assertEquals(1, routing(report).get("attempts"));
        assertFalse(classification.classifyNext(), "the retry is not due yet");
        makeDue();
        assertTrue(classification.classifyNext());
        makeDue();
        assertTrue(classification.classifyNext());

        assertEquals("NEEDS_REVIEW", routing(report).get("state"));
        assertEquals(3, routing(report).get("attempts"));
        assertEquals("Automatic classification unavailable", routing(report).get("reason"));
    }

    @Test
    void anUnreadablePhotoCountsAsAFailedAttempt() throws Exception {
        var estate = estate();
        var report = queuedReport(estate);
        image(report, new byte[] {1});
        when(imageStore.read(any()))
                .thenThrow(new ResidentReportException(HttpStatus.SERVICE_UNAVAILABLE, "Image storage down"));

        assertTrue(classification.classifyNext());

        assertEquals("CLASSIFYING", routing(report).get("state"));
        assertEquals(1, routing(report).get("attempts"));
        verify(classifier, never()).classify(any());
    }

    @Test
    void withoutAModelOrForAnInactiveEstateReportsGoStraightToReview() throws Exception {
        var estate = estate();
        var withoutModel = queuedReport(estate);
        when(classifier.available()).thenReturn(false);
        assertTrue(classification.classifyNext());
        assertEquals(
                "Automatic classification unavailable", routing(withoutModel).get("reason"));

        when(classifier.available()).thenReturn(true);
        var inactive = estate();
        var report = queuedReport(inactive);
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", inactive);
        assertTrue(classification.classifyNext());
        assertEquals("Estate is inactive", routing(report).get("reason"));
        verify(classifier, never()).classify(any());
    }

    @Test
    void reportsFromBeforeRoutingExistedAreNeverClassified() throws Exception {
        var estate = estate();
        report(estate, level(estate));

        assertFalse(classification.classifyNext());
        verifyNoInteractions(classifier);
    }

    // --- Manager review ----------------------------------------------------------------------------------------

    @Test
    void aManagerSendsAnEscalatedReportAsAWorkOrderWithTheChosenPriority() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var report = reviewReport(estate);

        mvc.perform(send(estate, report, "LIFT", "HIGH"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.state").value("WORK_ORDER"))
                .andExpect(jsonPath("$.decidedAt").exists())
                .andExpect(jsonPath("$.workOrder.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.workOrder.dispatch.approval").value("MANAGER"))
                .andExpect(jsonPath("$.workOrder.dispatch.contractorEmail").value("lift@contractor.example"));

        var order = workOrderFor(report);
        assertEquals("HIGH", order.get("priority"));
        assertEquals("estate-owner", order.get("createdByUserId"));
        assertEquals("estate-owner", lastStatusChanger((UUID) order.get("id")));
        assertEquals("estate-owner", dispatchFor((UUID) order.get("id")).get("approvedByUserId"));
        assertEquals("estate-owner", routing(report).get("decidedByUserId"));
    }

    @Test
    void sendingNeedsAContractorForTheTypeAndAReportAwaitingReview() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var review = reviewReport(estate);
        var classifying = queuedReport(estate);
        var legacy = report(estate, level(estate));

        mvc.perform(send(estate, review, "PUMP", "MEDIUM")).andExpect(status().isConflict());
        mvc.perform(send(estate, classifying, "LIFT", "MEDIUM")).andExpect(status().isConflict());
        mvc.perform(send(estate, legacy, "LIFT", "MEDIUM")).andExpect(status().isConflict());
        mvc.perform(send(estate, review, "ESCALATOR", "MEDIUM")).andExpect(status().isBadRequest());
        assertEquals(0, count("WorkOrder", estate));
        mvc.perform(send(estate, review, "LIFT", "MEDIUM")).andExpect(status().isCreated());
        mvc.perform(send(estate, review, "LIFT", "MEDIUM")).andExpect(status().isConflict());
        assertEquals(1, count("WorkOrder", estate));
    }

    @Test
    void aManagerDismissesAnEscalatedReportAndItCannotBeSentAfterwards() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var report = reviewReport(estate);

        mvc.perform(as("estate-owner", post(detail(estate, report) + "/dismiss")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("DISMISSED"));

        mvc.perform(as("estate-owner", post(detail(estate, report) + "/dismiss")))
                .andExpect(status().isConflict());
        mvc.perform(send(estate, report, "LIFT", "MEDIUM")).andExpect(status().isConflict());
        assertEquals(0, count("WorkOrder", estate));
    }

    @Test
    void creatingAWorkOrderFromAReportAwaitingReviewThroughTheExistingFormClearsTheReview() throws Exception {
        var estate = estate();
        var report = reviewReport(estate);

        var created = mvc.perform(as(
                        "estate-owner",
                        post(workOrders(estate))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                {"description":"Check the lift lobby","locationId":"%s","category":"EQUIPMENT_FAULT",
                                "priority":"MEDIUM","source":"RESIDENT_REPORT","sourceReportId":"%s",
                                "expectedSourceLocationId":"%s"}
                                """.formatted(locationOf(report), report, locationOf(report)))))
                .andExpect(status().isCreated())
                .andReturn();
        var order = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        var row = routing(report);
        assertEquals("WORK_ORDER", row.get("state"));
        assertEquals(UUID.fromString((String) order), row.get("workOrderId"));
        assertEquals("estate-owner", row.get("decidedByUserId"));
        assertEquals(0, count("WorkOrderDispatch", estate));
        assertEquals("OPEN", workOrderFor(report).get("status"));
    }

    @Test
    void aManagerCanEmailTheContractorAboutAnExistingReportWorkOrder() throws Exception {
        var estate = estate();
        contractor(estate, "PUMP");
        var order = reportWorkOrder(estate, "EQUIPMENT_FAULT");

        mvc.perform(dispatch(estate, order, "PUMP"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.equipmentType").value("PUMP"))
                .andExpect(jsonPath("$.approval").value("MANAGER"))
                .andExpect(jsonPath("$.status").value("PENDING"));

        assertEquals("ASSIGNED", db.fetchValue("select status from \"WorkOrder\" where id=?", order));
        mvc.perform(as("estate-owner", get(workOrders(estate) + "/" + order + "/dispatch")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dispatch.contractorEmail").value("pump@contractor.example"));
        mvc.perform(dispatch(estate, order, "PUMP")).andExpect(status().isConflict());
    }

    @Test
    void onlyOpenEquipmentFaultWorkOrdersFromAReportCanBeEmailed() throws Exception {
        var estate = estate();
        contractor(estate, "PUMP");
        var cleanliness = reportWorkOrder(estate, "CLEANLINESS");
        var manual = manualWorkOrder(estate);
        var started = reportWorkOrder(estate, "EQUIPMENT_FAULT");
        db.execute("update \"WorkOrder\" set status='IN_PROGRESS' where id=?", started);
        var noRoute = reportWorkOrder(estate, "EQUIPMENT_FAULT");

        mvc.perform(dispatch(estate, cleanliness, "PUMP")).andExpect(status().isConflict());
        mvc.perform(dispatch(estate, manual, "PUMP")).andExpect(status().isConflict());
        mvc.perform(dispatch(estate, started, "PUMP")).andExpect(status().isConflict());
        mvc.perform(dispatch(estate, noRoute, "GATE")).andExpect(status().isConflict());
        mvc.perform(as("estate-owner", get(workOrders(estate) + "/" + manual + "/dispatch")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dispatch").doesNotExist());
        assertEquals(0, count("WorkOrderDispatch", estate));
    }

    @Test
    void crewSeeRoutingAndTheContractorButCannotAct() throws Exception {
        var estate = estate();
        member(estate, "crew", "CREW");
        contractor(estate, "LIFT");
        var review = reviewReport(estate);
        var routed = reviewReport(estate);
        mvc.perform(send(estate, routed, "LIFT", "MEDIUM")).andExpect(status().isCreated());
        var order = (UUID) workOrderFor(routed).get("id");
        db.execute("update \"WorkOrderDispatch\" set status='FAILED' where \"workOrderId\"=?", order);

        mvc.perform(as("crew", get(detail(estate, routed))))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.routing.workOrder.dispatch.contractorEmail").value("lift@contractor.example"));
        mvc.perform(as("crew", get(workOrders(estate) + "/" + order + "/dispatch")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dispatch.status").value("FAILED"));
        mvc.perform(as(
                        "crew",
                        post(detail(estate, review) + "/work-order")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"equipmentType\":\"LIFT\",\"priority\":\"MEDIUM\"}")))
                .andExpect(status().isForbidden());
        mvc.perform(as("crew", post(detail(estate, review) + "/dismiss"))).andExpect(status().isForbidden());
        mvc.perform(as("crew", post(workOrders(estate) + "/" + order + "/dispatch/retry")))
                .andExpect(status().isForbidden());
        assertEquals("NEEDS_REVIEW", routing(review).get("state"));
    }

    @Test
    void reportsAndWorkOrdersOutsideTheEstateAreHidden() throws Exception {
        var estate = estate();
        var other = estate();
        contractor(other, "LIFT");
        var foreign = reviewReport(other);
        mvc.perform(send(other, foreign, "LIFT", "MEDIUM")).andExpect(status().isCreated());
        var order = workOrderFor(foreign).get("id");
        var foreignReview = reviewReport(other);

        mvc.perform(send(estate, foreignReview, "LIFT", "MEDIUM")).andExpect(status().isNotFound());
        mvc.perform(as("estate-owner", post(detail(estate, foreignReview) + "/dismiss")))
                .andExpect(status().isNotFound());
        mvc.perform(as("estate-owner", post(workOrders(estate) + "/" + order + "/dispatch/retry")))
                .andExpect(status().isNotFound());
        mvc.perform(as("estate-owner", get(workOrders(estate) + "/" + order + "/dispatch")))
                .andExpect(status().isNotFound());
    }

    @Test
    void theEstateReportListShowsRoutingAndFiltersByRoutingState() throws Exception {
        var estate = estate();
        var review = reviewReport(estate);
        queuedReport(estate);
        var legacy = report(estate, level(estate));

        mvc.perform(as("estate-owner", get(reports(estate))))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(
                        jsonPath("$.items[?(@.id=='" + legacy + "')].routing").value(contains((Object) null)));
        mvc.perform(as("estate-owner", get(reports(estate)).param("routingState", "NEEDS_REVIEW")))
                .andExpect(jsonPath("$.items[*].id", contains(review.toString())));
        mvc.perform(as("estate-owner", get(reports(estate)).param("routingState", "LOST")))
                .andExpect(status().isBadRequest());
    }

    // --- Email delivery ----------------------------------------------------------------------------------------

    @Test
    void aPendingDispatchIsEmailedWithTheWorkOrderReferenceAndTheResidentsWordsAndPhotos() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var report = reviewReport(estate);
        image(report, new byte[] {7, 7, 7});
        when(imageStore.read(any())).thenReturn(new byte[] {7, 7, 7});
        mvc.perform(send(estate, report, "LIFT", "MEDIUM")).andExpect(status().isCreated());
        var order = workOrderFor(report);

        assertTrue(delivery.deliverNext());

        var email = ArgumentCaptor.forClass(WorkOrderEmail.class);
        verify(sender).send(email.capture());
        assertEquals("lift@contractor.example", email.getValue().to());
        assertEquals(
                "Work order " + order.get("reference") + ": Lift fault at Maple Estate",
                email.getValue().subject());
        assertTrue(email.getValue().body().contains("Doors won't open at level 3"));
        assertFalse(email.getValue().body().contains("resident-a"));
        assertArrayEquals(
                new byte[] {7, 7, 7}, email.getValue().attachments().getFirst().bytes());
        var dispatch = dispatchFor((UUID) order.get("id"));
        assertEquals("SENT", dispatch.get("status"));
        assertNotNull(dispatch.get("sentAt"));
        assertEquals("ASSIGNED", workOrderFor(report).get("status"), "sending does not change the status");
        assertFalse(delivery.deliverNext());
    }

    @Test
    void failedSendsAreRetriedFiveTimesThenAManagerCanRetry() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var report = reviewReport(estate);
        mvc.perform(send(estate, report, "LIFT", "MEDIUM")).andExpect(status().isCreated());
        var order = (UUID) workOrderFor(report).get("id");
        doThrow(new WorkOrderSendException("SMTP_AUTH", "rejected"))
                .when(sender)
                .send(any());

        for (int attempt = 1; attempt <= 5; attempt++) {
            assertTrue(delivery.deliverNext());
            makeDue();
        }

        assertEquals("FAILED", dispatchFor(order).get("status"));
        assertEquals("SMTP_AUTH", dispatchFor(order).get("lastErrorCode"));
        assertEquals("ASSIGNED", workOrderFor(report).get("status"));
        assertFalse(delivery.deliverNext());
        mvc.perform(as("estate-owner", post(workOrders(estate) + "/" + order + "/dispatch/retry")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
        mvc.perform(as("estate-owner", post(workOrders(estate) + "/" + order + "/dispatch/retry")))
                .andExpect(status().isConflict());
        reset(sender);
        assertTrue(delivery.deliverNext());
        assertEquals("SENT", dispatchFor(order).get("status"));
    }

    @Test
    void anUnreadablePhotoBlocksSendingRatherThanSendingWithoutIt() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var report = reviewReport(estate);
        image(report, new byte[] {1});
        when(imageStore.read(any()))
                .thenThrow(new ResidentReportException(HttpStatus.SERVICE_UNAVAILABLE, "Image storage down"));
        mvc.perform(send(estate, report, "LIFT", "MEDIUM")).andExpect(status().isCreated());

        assertTrue(delivery.deliverNext());

        verifyNoInteractions(sender);
        var dispatch = dispatchFor((UUID) workOrderFor(report).get("id"));
        assertEquals("PENDING", dispatch.get("status"));
        assertEquals("IMAGE_STORAGE", dispatch.get("lastErrorCode"));
    }

    @Test
    void changingTheContractorDoesNotRedirectAnExistingDispatch() throws Exception {
        var estate = estate();
        contractor(estate, "LIFT");
        var report = reviewReport(estate);
        mvc.perform(send(estate, report, "LIFT", "MEDIUM")).andExpect(status().isCreated());
        mvc.perform(saveContractor(estate, "LIFT", "New Lifts", "new@lifts.example"))
                .andExpect(status().isOk());

        assertTrue(delivery.deliverNext());

        var email = ArgumentCaptor.forClass(WorkOrderEmail.class);
        verify(sender).send(email.capture());
        assertEquals("lift@contractor.example", email.getValue().to());
        assertTrue(email.getValue().subject().startsWith("Work order "));
    }

    // --- Helpers -----------------------------------------------------------------------------------------------

    private UUID estate() {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "Estate" (id, "ownerUserId", name, code, address, "postalCode", "updatedAt")
                values (?, 'estate-owner', 'Maple Estate', ?, '1 Maple Road', '123456', now())
                """, id, "MP" + id.toString().substring(0, 8));
        member(id, "estate-owner", "MANAGER");
        return id;
    }

    private void member(UUID estate, String user, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estate, user, role);
    }

    private UUID level(UUID estate) {
        var block = UUID.randomUUID();
        db.execute("""
                insert into "Location" (id, "estateId", type, name, "updatedAt")
                values (?, ?, 'BLOCK', 'Block A', now())
                """, block, estate);
        var level = UUID.randomUUID();
        db.execute("""
                insert into "Location" (id, "estateId", type, "parentId", "parentType", name, "sortOrder", "updatedAt")
                values (?, ?, 'LEVEL', ?, 'BLOCK', 'Level 4', 4, now())
                """, level, estate, block);
        return level;
    }

    private void contractor(UUID estate, String type) {
        var email = type.toLowerCase() + "@contractor.example";
        var provider = UUID.randomUUID();
        db.execute("""
                insert into "ServiceProvider" (id, "estateId", name, email, "updatedAt")
                values (?, ?, ?, ?, now())
                """, provider, estate, "Acme " + type, email);
        db.execute("""
                insert into "EquipmentProviderRoute" ("estateId", "equipmentType", "providerId", "updatedAt")
                values (?, ?, ?, now())
                """, estate, type, provider);
    }

    private UUID provider(UUID estate, String email) {
        return db.fetchOne("select id from \"ServiceProvider\" where \"estateId\"=? and email=?", estate, email)
                .get(0, UUID.class);
    }

    private UUID report(UUID estate, UUID location) {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "IssueReport" (id, "estateId", "locationId", "submittedByUserId", title, description,
                    status, "createdAt", "updatedAt")
                values (?, ?, ?, 'resident-a', 'Lift stuck', 'Doors won''t open at level 3', 'SUBMITTED', now(), now())
                """, id, estate, location);
        return id;
    }

    private UUID queuedReport(UUID estate) {
        var report = report(estate, level(estate));
        db.execute("""
                insert into "ReportRouting" ("reportId", "estateId", state, "nextAttemptAt", "updatedAt")
                values (?, ?, 'CLASSIFYING', now() - interval '1 second', now())
                """, report, estate);
        return report;
    }

    private UUID reviewReport(UUID estate) {
        var report = report(estate, level(estate));
        db.execute("""
                insert into "ReportRouting" ("reportId", "estateId", state, reason, "updatedAt")
                values (?, ?, 'NEEDS_REVIEW', 'Water near the lift lobby needs an on-site check', now())
                """, report, estate);
        return report;
    }

    private UUID reportWorkOrder(UUID estate, String category) throws Exception {
        var report = report(estate, level(estate));
        var created = mvc.perform(as(
                        "estate-owner",
                        post(workOrders(estate))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                {"description":"Pump noisy","locationId":"%s","category":"%s","priority":"MEDIUM",
                                "source":"RESIDENT_REPORT","sourceReportId":"%s","expectedSourceLocationId":"%s"}
                                """.formatted(locationOf(report), category, report, locationOf(report)))))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(JsonPath.read(created.getResponse().getContentAsString(), "$.id"));
    }

    private UUID manualWorkOrder(UUID estate) throws Exception {
        var created = mvc.perform(as(
                        "estate-owner",
                        post(workOrders(estate))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                {"description":"Pump noisy","locationId":"%s","category":"EQUIPMENT_FAULT",
                                "priority":"MEDIUM","source":"MANUAL"}
                                """.formatted(level(estate)))))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(JsonPath.read(created.getResponse().getContentAsString(), "$.id"));
    }

    private void image(UUID report, byte[] bytes) {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "IssueReportImage" (id, "reportId", "storageKey", "contentType", "sizeBytes")
                values (?, ?, ?, 'image/jpeg', ?)
                """, id, report, "private/" + id, bytes.length);
    }

    private void makeDue() {
        db.execute("update \"ReportRouting\" set \"nextAttemptAt\"=now() - interval '1 hour', \"leaseUntil\"=null");
        db.execute("update \"WorkOrderDispatch\" set \"nextAttemptAt\"=now() - interval '1 hour', \"leaseUntil\"=null");
    }

    private UUID locationOf(UUID report) {
        return db.fetchOne("select \"locationId\" from \"IssueReport\" where id=?", report)
                .get(0, UUID.class);
    }

    private Map<String, Object> routing(UUID report) {
        var row = db.fetchOne("select * from \"ReportRouting\" where \"reportId\"=?", report);
        assertNotNull(row);
        return row.intoMap();
    }

    private Map<String, Object> workOrderFor(UUID report) {
        var row = db.fetchOne("select * from \"WorkOrder\" where \"sourceReportId\"=?", report);
        assertNotNull(row);
        return row.intoMap();
    }

    private Map<String, Object> dispatchFor(UUID workOrder) {
        var row = db.fetchOne("select * from \"WorkOrderDispatch\" where \"workOrderId\"=?", workOrder);
        assertNotNull(row);
        return row.intoMap();
    }

    private List<String> statusHistory(UUID workOrder) {
        return db.fetch(
                        "select \"toStatus\" from \"WorkOrderStatusEvent\" where \"workOrderId\"=? order by version",
                        workOrder)
                .getValues(0, String.class);
    }

    private String lastStatusChanger(UUID workOrder) {
        return db.fetchOne(
                        "select \"changedByUserId\" from \"WorkOrderStatusEvent\" where \"workOrderId\"=? "
                                + "order by version desc limit 1",
                        workOrder)
                .get(0, String.class);
    }

    private int count(String table, UUID estate) {
        return count(table, estate, "estateId");
    }

    private int count(String table, UUID value, String column) {
        return db.fetchOne("select count(*) from \"" + table + "\" where \"" + column + "\"=?", value)
                .get(0, Integer.class);
    }

    private static String contractors(UUID estate) {
        return "/estates/" + estate + "/contractors";
    }

    private static String reports(UUID estate) {
        return "/estates/" + estate + "/reports";
    }

    private static String detail(UUID estate, UUID report) {
        return reports(estate) + "/" + report;
    }

    private static String workOrders(UUID estate) {
        return "/estates/" + estate + "/work-orders";
    }

    private MockHttpServletRequestBuilder saveContractor(UUID estate, String type, String name, String email) {
        return as(
                "estate-owner",
                put(contractors(estate) + "/" + type)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":" + json(name) + ",\"email\":" + json(email) + "}"));
    }

    private static String json(String value) {
        if (value.startsWith("\"")) return value;
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static MockHttpServletRequestBuilder send(UUID estate, UUID report, String type, String priority) {
        return as(
                "estate-owner",
                post(detail(estate, report) + "/work-order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"equipmentType\":\"" + type + "\",\"priority\":\"" + priority + "\"}"));
    }

    private static MockHttpServletRequestBuilder dispatch(UUID estate, UUID order, String type) {
        return as(
                "estate-owner",
                post(workOrders(estate) + "/" + order + "/dispatch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"equipmentType\":\"" + type + "\"}"));
    }

    private static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                    .JwtRequestPostProcessor
            identity(String user) {
        return jwt().jwt(token -> token.subject(user).claim("role", "user"))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
    }

    private static MockHttpServletRequestBuilder as(String user, MockHttpServletRequestBuilder request) {
        return request.with(identity(user));
    }
}
