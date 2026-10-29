class NotFoundError(Exception):
    """The record doesn't exist or belongs to someone else (the two look identical to callers)."""


class ConflictError(Exception):
    pass
