package com.proj.server.risk;

/** The gamma posterior on the Weibull scale: {@code a = a0 + failures}, {@code b = b0 + sum(t^k)}. */
public record Posterior(double a, double b) {}
