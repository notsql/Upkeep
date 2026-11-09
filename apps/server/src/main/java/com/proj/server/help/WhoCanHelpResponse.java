package com.proj.server.help;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** The display names of the roles whose current members can do the action, the estate owner last. */
@Schema(requiredProperties = {"action", "roles"})
public record WhoCanHelpResponse(HelpAction action, List<String> roles) {}
