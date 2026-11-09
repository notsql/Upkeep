package com.proj.server.help;

import io.swagger.v3.oas.annotations.media.Schema;

/** An action a warning points at. Who-can-help names the roles allowed to do it. */
@Schema(enumAsRef = true)
public enum HelpAction {
    REPLACE_SENSOR,
    PAUSE_SENSOR_WARNINGS,
    GENERATE_CONNECTION_KEY,
    RECORD_CONDITION,
    ACKNOWLEDGE_ALERT,
    REVIEW_DUPLICATE,
    SEND_CREW,
    SEND_CONTRACTOR
}
