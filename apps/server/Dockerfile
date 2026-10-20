# Build from the repo root: `docker compose build server`.
# The Maven reactor is rooted at the workspace, so the root pom.xml and wrapper
# are required for the build to resolve apps/server as a module.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# Copy only what Maven needs first, so dependency resolution stays cached.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
COPY apps/server/pom.xml apps/server/
RUN ./mvnw -B -pl apps/server -am dependency:go-offline

COPY apps/server/src apps/server/src
RUN ./mvnw -B -pl apps/server -am package -DskipTests \
  && cp apps/server/target/*.jar app.jar

FROM eclipse-temurin:25-jre AS runtime
WORKDIR /app
# curl is used by the compose healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --create-home spring

# Unpack the fat jar into plain jars (no nested-jar unpacking at startup), then
# record a JDK AOT cache from a training run that stops once the context has
# refreshed. Both cut Spring's cold start, which matters on Cloud Run where the
# service scales to zero. The training run never connects to the database:
# the datasource values below only satisfy property placeholders.
COPY --from=build /workspace/app.jar /tmp/app.jar
RUN java -Djarmode=tools -jar /tmp/app.jar extract --destination /app/application \
  && rm /tmp/app.jar \
  && SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/training \
     SPRING_DATASOURCE_USERNAME=training SPRING_DATASOURCE_PASSWORD=training \
     java --enable-native-access=ALL-UNNAMED -XX:AOTCacheOutput=/app/application/app.aot \
       -Dspring.context.exit=onRefresh -jar /app/application/app.jar \
  && chown -R spring /app

# onnxruntime loads its native library via System::load; grant native access
# explicitly (training run above too, so the AOT cache matches) instead of
# letting JDK 25 warn on every start.
USER spring
EXPOSE 8080
ENTRYPOINT ["java", "--enable-native-access=ALL-UNNAMED", "-XX:AOTCache=/app/application/app.aot", "-jar", "/app/application/app.jar"]
