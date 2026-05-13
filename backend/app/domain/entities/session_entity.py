class SessionInfo:
    def __init__(self, id, device, ip, last_used, is_current):
        self.id = id
        self.device = device
        self.ip = ip
        self.last_used = last_used
        self.is_current = is_current