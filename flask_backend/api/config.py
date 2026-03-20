class Config(object):
    """
    Default Configuration
    """

    base_url = "http://localhost:5000/"
    TEMP_PATH = "/tmp/sqlalchemy-media"


class DevelopmentConfig(Config):
    """
    Development Configuration
    """

    DEBUG = True


class DeploymentConfig(Config):
    """
    Deployment Configuration
    """

    DEBUG = False


class TestingConfig(Config):
    """Configurations for Testing, with a separate test database."""
    TESTING = True
    DEBUG = True
