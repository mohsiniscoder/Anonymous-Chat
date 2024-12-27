import pydivert
import threading
from collections import defaultdict
import json

# Ports for frontend (3000) and backend (3001) where Socket.IO is used
valid_ports = [3000, 3001]

# Store packet data for visualization or further processing
packet_data = defaultdict(int)

# Function to check if the packet contains meaningful data (non keep-alive)
def is_meaningful_packet(packet_raw):
    # Here you can check for specific patterns or payload content
    # For simplicity, let's assume that real messages have a JSON structure
    try:
        # Try to decode the packet as JSON (Socket.IO typically uses JSON for messages)
        payload = packet_raw.decode('utf-8', errors='ignore')  # Decode raw packet data to string
        if payload.startswith('42'):  # Socket.IO message prefix
            # Look for specific fields in the message payload to differentiate real messages
            try:
                message = json.loads(payload[2:])  # Remove the '42' prefix (if present) and parse JSON
                # Check if the message has a "type" field or other real message indicators
                if isinstance(message, dict) and 'type' in message:
                    return True
            except json.JSONDecodeError:
                return False
    except UnicodeDecodeError:
        pass  # Ignore packets that cannot be decoded as UTF-8 strings
    
    return False  # Return False for non-meaningful packets

def capture_packets():
    try:
        # Set up a filter to sniff on both frontend (3000) and backend (3001) ports
        filter_expression = " or ".join([f"tcp.DstPort == {port} or tcp.SrcPort == {port}" for port in valid_ports])

        with pydivert.WinDivert(filter_expression) as w:
            for packet in w:
                # Check if the packet has IP and TCP attributes
                if hasattr(packet, 'ip') and hasattr(packet, 'tcp'):
                    ip = packet.ip
                    tcp = packet.tcp

                    # Extract necessary packet details for IPv4 and IPv6
                    if hasattr(ip, 'src') and hasattr(ip, 'dst'):  # IPv4
                        src_ip = ip.src
                        dst_ip = ip.dst
                    elif hasattr(ip, 'src_addr') and hasattr(ip, 'dst_addr'):  # IPv6
                        src_ip = ip.src_addr
                        dst_ip = ip.dst_addr
                    else:
                        continue  # Skip the packet if it doesn't have the correct IP attributes

                    # Access source and destination ports from TCP
                    src_port = tcp.src_port
                    dst_port = tcp.dst_port
                    packet_raw = packet.raw  # Access raw packet data
                    packet_length = len(packet_raw)  # Get the length of raw packet data
                    
                    # Enforce capturing packets on the specified ports (3000 for frontend, 3001 for backend)
                    if src_port in valid_ports or dst_port in valid_ports:
                        # Check if the packet contains meaningful data (not just keep-alive)
                        if is_meaningful_packet(packet_raw):
                            # Safe access to TCP sequence and acknowledgment numbers
                            sequence_number = getattr(tcp, 'seq', None)  # Use getattr to avoid AttributeError
                            ack_number = getattr(tcp, 'ack', None)  # Use getattr to avoid AttributeError
                            flags = tcp.flags if hasattr(tcp, 'flags') else None  # Handle case if flags are missing

                            # Print packet info for Socket.IO traffic
                            print(f"Packet captured:")
                            print(f"  Source IP: {src_ip} | Destination IP: {dst_ip}")
                            print(f"  Source Port: {src_port} | Destination Port: {dst_port}")
                            print(f"  Packet Length: {packet_length} bytes")
                            print(f"  TCP Sequence Number: {sequence_number if sequence_number is not None else 'N/A'}")
                            print(f"  TCP Ack Number: {ack_number if ack_number is not None else 'N/A'}")
                            print(f"  TCP Flags: {flags if flags is not None else 'N/A'}")
                            print("-" * 50)

                            # Add packet length to the corresponding source-destination pair for further processing
                            packet_data[(src_ip, dst_ip)] += packet_length

                # Continue to send the packet (non-blocking)
                w.send(packet)

    except Exception as e:
        print(f"Error in packet capture: {e}")

# Function to start packet capturing in a separate thread
def start_capture():
    capture_thread = threading.Thread(target=capture_packets, daemon=True)
    capture_thread.start()

# Start packet capturing
start_capture()

# Keep the main program running while capturing packets in the background
try:
    while True:
        pass
except KeyboardInterrupt:
    print("Packet capture terminated.")
