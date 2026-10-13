package com.proj.server.dashboard;

import com.proj.server.dashboard.DashboardRepository.EstateCounts;
import com.proj.server.dashboard.DashboardSummaryResponse.DashboardConditionCounts;
import com.proj.server.dashboard.DashboardSummaryResponse.DashboardEstateSummary;
import java.util.Comparator;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {
    private final DashboardRepository repository;

    public DashboardService(DashboardRepository repository) {
        this.repository = repository;
    }

    public DashboardSummaryResponse summary(String user) {
        var counts = repository.summary(user);
        var estates = counts.estates();
        int active = (int) estates.stream().filter(EstateCounts::active).count();
        int owned = (int) estates.stream().filter(e -> e.owned() && e.active()).count();
        var attention = estates.stream()
                .filter(e -> e.attentionCount() > 0)
                .sorted(Comparator.comparingLong(EstateCounts::attentionCount)
                        .reversed()
                        .thenComparing(
                                Comparator.comparingLong(EstateCounts::faulty).reversed())
                        .thenComparing(EstateCounts::code)
                        .thenComparing(EstateCounts::id))
                .toList();
        return new DashboardSummaryResponse(
                estates.size(),
                active,
                estates.size() - active,
                owned,
                counts.councilMemberCount(),
                estates.stream().mapToLong(EstateCounts::total).sum(),
                new DashboardConditionCounts(
                        estates.stream().mapToLong(EstateCounts::good).sum(),
                        estates.stream().mapToLong(EstateCounts::needsAttention).sum(),
                        estates.stream().mapToLong(EstateCounts::faulty).sum(),
                        estates.stream().mapToLong(EstateCounts::unassessed).sum()),
                attention.size(),
                attention.stream()
                        .limit(5)
                        .map(e -> new DashboardEstateSummary(
                                e.id(), e.name(), e.code(), e.total(), e.needsAttention(), e.faulty()))
                        .toList());
    }
}
