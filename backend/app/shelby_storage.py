import requests

SHELBY_API = "https://api.shelby.xyz/upload"

def upload_to_shelby(file_path):
    with open(file_path, "rb") as f:
        files = {"file": f}
        response = requests.post(SHELBY_API, files=files)

    if response.status_code != 200:
        raise Exception("Shelby upload failed")

    return response.json()
