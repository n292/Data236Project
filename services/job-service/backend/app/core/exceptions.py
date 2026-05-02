class JobServiceError(Exception):
    def __init__(self, code: str, details: list | None = None):
        super().__init__(code)
        self.code = code
        self.details = details or []
