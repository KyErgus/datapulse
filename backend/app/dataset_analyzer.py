import csv
from pathlib import Path


def analyze_dataset(file_path: str):

    path = Path(file_path)

    result = {
        "file_type": path.suffix,
        "rows": 0,
        "columns": 0,
        "columns_names": [],
        "preview": []
    }

    if path.suffix.lower() == ".csv":

        with open(path, newline="") as csvfile:

            reader = csv.DictReader(csvfile)

            result["columns_names"] = reader.fieldnames
            result["columns"] = len(reader.fieldnames)

            preview = []

            for i, row in enumerate(reader):

                if i < 10:
                    preview.append(row)

                result["rows"] += 1

            result["preview"] = preview

    return result
