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
USER spring
COPY --from=build /workspace/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
