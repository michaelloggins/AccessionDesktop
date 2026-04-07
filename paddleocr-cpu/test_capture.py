"""Capture PaddleOCR-VL predict() output structure for debugging.

Run inside the Docker container:
  docker exec -it accessiondesktop-ocr-1 python /app/test_capture.py /app/testdata/test.pdf
"""

import json
import sys
import os
import tempfile
import time
import numpy as np


def describe_value(v, depth=0, max_depth=4):
    """Recursively describe a value's structure, preserving strings but summarizing arrays."""
    if depth > max_depth:
        return f"<{type(v).__name__} (truncated)>"

    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        if isinstance(v, (np.integer,)):
            return int(v)
        if isinstance(v, (np.floating,)):
            return float(v)
        return v
    if isinstance(v, str):
        if len(v) > 2000:
            return v[:2000] + f"... (total {len(v)} chars)"
        return v
    if isinstance(v, np.ndarray):
        return f"<numpy.ndarray shape={v.shape} dtype={v.dtype}>"
    if isinstance(v, dict):
        return {str(k): describe_value(val, depth + 1, max_depth) for k, val in v.items()}
    if isinstance(v, (list, tuple)):
        if len(v) == 0:
            return []
        if len(v) <= 5:
            return [describe_value(item, depth + 1, max_depth) for item in v]
        # Show first 3 and last 1
        sample = [describe_value(v[i], depth + 1, max_depth) for i in range(3)]
        sample.append(f"... ({len(v)} items total)")
        sample.append(describe_value(v[-1], depth + 1, max_depth))
        return sample
    # Fallback: check for Result-like objects with known properties
    return f"<{type(v).__name__}>"


def inspect_result_object(res):
    """Deeply inspect a PaddleOCR Result object."""
    info = {
        "type": type(res).__name__,
        "module": type(res).__module__,
    }

    # Check for known properties
    for prop in ["markdown", "json", "img", "text", "html"]:
        try:
            val = getattr(res, prop, "__MISSING__")
            if val != "__MISSING__":
                info[f"property_{prop}"] = describe_value(val)
                print(f"\n=== res.{prop} ===")
                if isinstance(val, str):
                    print(val[:3000])
                elif isinstance(val, dict):
                    print(json.dumps(describe_value(val), indent=2, default=str)[:3000])
                else:
                    print(f"Type: {type(val).__name__}, Value: {str(val)[:500]}")
        except Exception as e:
            info[f"property_{prop}_error"] = str(e)

    # Check for dict-like access
    try:
        keys = list(res.keys()) if hasattr(res, "keys") else None
        if keys:
            info["dict_keys"] = keys
            print(f"\n=== Dict keys: {keys} ===")
            for k in keys:
                try:
                    v = res[k]
                    info[f"key_{k}"] = describe_value(v)
                except Exception as e:
                    info[f"key_{k}_error"] = str(e)
    except Exception:
        pass

    # Check dir() for interesting attributes
    attrs = [a for a in dir(res) if not a.startswith("_")]
    info["public_attributes"] = attrs
    print(f"\n=== Public attributes: {attrs} ===")

    # Try to get the internal dict representation
    if hasattr(res, "__dict__"):
        d = res.__dict__
        safe_dict = describe_value(d)
        info["__dict__"] = safe_dict
        print(f"\n=== __dict__ keys: {list(d.keys()) if isinstance(d, dict) else 'N/A'} ===")

    return info


def main():
    test_file = sys.argv[1] if len(sys.argv) > 1 else "/app/testdata/test.pdf"
    if not os.path.exists(test_file):
        print(f"ERROR: Test file not found: {test_file}")
        sys.exit(1)

    print(f"Test file: {test_file} ({os.path.getsize(test_file)} bytes)")

    print("\n--- Loading PaddleOCRVL ---")
    start = time.time()
    from paddleocr import PaddleOCRVL
    pipeline = PaddleOCRVL(device="cpu")
    print(f"Model loaded in {time.time() - start:.1f}s")

    print("\n--- Running predict() ---")
    start = time.time()
    output = pipeline.predict(test_file)
    print(f"predict() returned: {type(output).__name__}")

    all_pages = []
    for i, res in enumerate(output):
        print(f"\n{'='*60}")
        print(f"PAGE {i}")
        print(f"{'='*60}")
        print(f"Result type: {type(res).__name__}")

        page_info = inspect_result_object(res)
        all_pages.append(page_info)

        # Also try save_to_markdown to a temp dir
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                res.save_to_markdown(save_path=tmpdir)
                for fname in os.listdir(tmpdir):
                    fpath = os.path.join(tmpdir, fname)
                    if os.path.isfile(fpath):
                        with open(fpath, "r") as f:
                            md_content = f.read()
                        print(f"\n=== save_to_markdown file '{fname}' ({len(md_content)} chars) ===")
                        print(md_content[:3000])
                        page_info["saved_markdown_content"] = md_content
                    elif os.path.isdir(fpath):
                        for subfname in os.listdir(fpath):
                            subfpath = os.path.join(fpath, subfname)
                            if os.path.isfile(subfpath) and subfname.endswith(".md"):
                                with open(subfpath, "r") as f:
                                    md_content = f.read()
                                print(f"\n=== save_to_markdown file '{subfname}' ({len(md_content)} chars) ===")
                                print(md_content[:3000])
                                page_info["saved_markdown_content"] = md_content
        except Exception as e:
            print(f"save_to_markdown error: {e}")
            page_info["save_to_markdown_error"] = str(e)

        # Try save_to_json
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                res.save_to_json(save_path=tmpdir)
                for fname in os.listdir(tmpdir):
                    fpath = os.path.join(tmpdir, fname)
                    if os.path.isfile(fpath):
                        with open(fpath, "r") as f:
                            json_content = f.read()
                        print(f"\n=== save_to_json file '{fname}' ({len(json_content)} chars) ===")
                        print(json_content[:5000])
                        page_info["saved_json_content"] = json.loads(json_content)
        except Exception as e:
            print(f"save_to_json error: {e}")
            page_info["save_to_json_error"] = str(e)

    elapsed = time.time() - start
    print(f"\n\nTotal inference time: {elapsed:.1f}s for {len(all_pages)} page(s)")

    # Save captured output
    output_path = "/app/captured_output.json"
    with open(output_path, "w") as f:
        json.dump(all_pages, f, indent=2, default=str)
    print(f"\nSaved captured structure to {output_path}")


if __name__ == "__main__":
    main()
