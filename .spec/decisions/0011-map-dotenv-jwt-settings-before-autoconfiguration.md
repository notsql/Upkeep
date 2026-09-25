# 0011 - Map dotenv JWT settings before auto-configuration

## Status

Accepted.

## Problem

The Nx Maven runner does not forward the project's dotenv values into the Java
process. Spring imports `.env` as a properties file, but uppercase underscore
keys in that source do not receive OS environment relaxed binding. The issuer
therefore appeared absent and SecurityConfig enabled its open local mode. Bearer
tokens were ignored, so estate endpoints rejected even signed-in users.

## Decision

An EnvironmentPostProcessor runs after config-data loading and maps the existing,
nonblank uppercase issuer/audience keys to Spring's canonical properties if
those properties are absent. This leaves OS environment values and explicit
canonical configuration intact. It never creates an empty issuer, so the
existing unconfigured local mode remains supported. Spring Boot still owns JWT
signature, issuer, expiry and audience validation; no custom decoder is added.

## Verification

A regression test sends a bearer token through the real security filter using
uppercase file-style settings, with a mocked decoder and no database access.
It failed with 401 before the fix. Missing tokens must receive the filter's
Bearer challenge. The web message no longer labels every 401 an expired session.
