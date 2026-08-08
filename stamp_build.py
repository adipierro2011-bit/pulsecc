#!/usr/bin/env python3
import sys
import os
import secrets
import random

MARKER = b"MARKER_BUILD_ID_START:"
BUFFER_SIZE = 80


def stamp_build(input_dll_path, output_dll_path, custom_build_id=None):
    if not os.path.exists(input_dll_path):
        print(f"[!] Input template file not found: {input_dll_path}")
        return False

    with open(input_dll_path, "rb") as f:
        data = bytearray(f.read())

    # Auto-generate a random high-entropy build ID if not specified
    if not custom_build_id:
        custom_build_id = f"BLD-{secrets.token_hex(4).upper()}"

    # Build replacement buffer
    replacement = MARKER + custom_build_id.encode('utf-8')
    if len(replacement) > BUFFER_SIZE:
        replacement = replacement[:BUFFER_SIZE]
    else:
        replacement = replacement.ljust(BUFFER_SIZE, b'\x00')

    # Locate and patch ALL binary marker instances in the file
    count = 0
    idx = data.find(MARKER)
    if idx == -1:
        print("[!] Error: MARKER_BUILD_ID_START signature not found in binary.")
        return False

    while idx != -1:
        data[idx : idx + BUFFER_SIZE] = replacement
        count += 1
        idx = data.find(MARKER, idx + BUFFER_SIZE)


    # Polymorphic signature mutation: append random bytes (16 to 64 bytes)

    # This alters the overall file length and SHA256 file hash for every build!
    random_padding = secrets.token_bytes(random.randint(16, 64))
    data.extend(random_padding)

    with open(output_dll_path, "wb") as f:
        f.write(data)

    print(f"[+] Successfully generated polymorphic build:")
    print(f"    - Output: {output_dll_path}")
    print(f"    - Build ID: {custom_build_id}")
    print(f"    - Total Bytes: {len(data)}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python stamp_build.py <input_template.dll> <output_stamped.dll> [optional_build_id]")
        print("Example: python stamp_build.py cheat_base.dll user_cheat.dll BLD-A9F2B8")
        sys.exit(1)

    in_dll = sys.argv[1]
    out_dll = sys.argv[2]
    b_id = sys.argv[3] if len(sys.argv) > 3 else None

    stamp_build(in_dll, out_dll, b_id)
