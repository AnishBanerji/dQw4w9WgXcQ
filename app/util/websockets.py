import hashlib
import base64

class WebSocket:
    def __init__(self):
        self.fin_bit = 0
        self.opcode = 0
        self.payload_length = 0
        self.payload = 0

def compute_accept(key):
    GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    appendKey = key + GUID
    keyHash = hashlib.sha1(appendKey.encode()).digest()
    return base64.b64encode(keyHash).decode()

def parse_ws_frame(data):
    out = WebSocket()
    finOp = data[0]
    maskPayload = data[1]

    out.fin_bit = finOp >> 7
    out.opcode = finOp & 0x0F

    mask_bit = maskPayload >> 7
    payload_length = maskPayload & 0x7F

    start = 2

    if payload_length < 126:
        out.payload_length = payload_length
    elif payload_length == 126:
        out.payload_length = int.from_bytes(data[start:start+2], byteorder='big')
        start += 2
    elif payload_length == 127:
        out.payload_length = int.from_bytes(data[start:start+8], byteorder='big')
        start += 8

    if mask_bit == 1:
        mask = data[start:start + 4]
        start += 4
        masked_payload = data[start:start + out.payload_length]
        out.payload = bytes(masked_payload[i] ^ mask[i % 4] for i in range(out.payload_length))
    else:
        out.payload = data[start:start + out.payload_length]

    return out

def generate_ws_frame(payload):
    out = bytearray()
    payload_length = len(payload)
    finOp = 0x81
    out.append(finOp)

    if payload_length < 126:
        out.append(payload_length)
    elif payload_length < 65536:
        out.append(126)
        out += payload_length.to_bytes(2, byteorder='big')
    else:
        out.append(127)
        out += payload_length.to_bytes(8, byteorder='big')
    
    return bytes(out + payload)