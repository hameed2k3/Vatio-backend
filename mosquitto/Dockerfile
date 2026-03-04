FROM eclipse-mosquitto:latest
COPY config/mosquitto.conf /mosquitto/config/mosquitto.conf

# Create data and log directories
RUN mkdir -p /mosquitto/data /mosquitto/log
RUN chown -R mosquitto:mosquitto /mosquitto
