import { useEffect, useState } from "react"

function App() {

  const [datasets, setDatasets] = useState([])
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)

  const loadDatasets = async () => {

    const res = await fetch("http://38.49.213.121:8000/datasets", {
      headers: {
        Authorization: "Bearer datapulse-admin-key"
      }
    })

    const data = await res.json()

    setDatasets(data)

  }

  useEffect(() => {

    loadDatasets()

  }, [])

  const uploadDataset = async () => {

    if (!file) return

    const formData = new FormData()

    formData.append("file", file)

    await fetch("http://38.49.213.121:8000/datasets/upload", {
      method: "POST",
      headers: {
        Authorization: "Bearer datapulse-admin-key"
      },
      body: formData
    })

    loadDatasets()

  }

  const loadPreview = async (id) => {

    const res = await fetch(`http://38.49.213.121:8000/datasets/${id}/preview`, {
      headers: {
        Authorization: "Bearer datapulse-admin-key"
      }
    })

    const data = await res.json()

    setPreview(data)

  }

  return (

    <div className="flex h-screen bg-gray-100">

      {/* Sidebar */}

      <div className="w-64 bg-gray-900 text-white p-6">

        <h1 className="text-2xl font-bold mb-8">🚀 DataPulse</h1>

        <nav className="space-y-4">

          <div className="hover:text-blue-400 cursor-pointer">Dashboard</div>

          <div className="hover:text-blue-400 cursor-pointer">My Datasets</div>

          <div className="hover:text-blue-400 cursor-pointer">Explore</div>

          <div className="hover:text-blue-400 cursor-pointer">Marketplace</div>

        </nav>

      </div>

      {/* Main */}

      <div className="flex-1 p-10 overflow-auto">

        <h2 className="text-2xl font-semibold mb-4">Upload Dataset</h2>

        <div className="flex gap-4 mb-8">

          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="border p-2 rounded"
          />

          <button
            onClick={uploadDataset}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Upload
          </button>

        </div>

        <h2 className="text-xl font-semibold mb-4">My Datasets</h2>

        {datasets.map((d) => (

          <div
            key={d.id}
            className="bg-white shadow p-4 mb-3 rounded cursor-pointer hover:bg-gray-50"
            onClick={() => loadPreview(d.id)}
          >

            <div className="font-bold">{d.filename}</div>

            <div className="text-sm text-gray-500">
              Size: {d.size} bytes
            </div>

            <div className="text-sm text-gray-500">
              Downloads: {d.download_count}
            </div>

          </div>

        ))}

        {preview && (

          <div className="mt-10">

            <h2 className="text-xl font-semibold mb-4">Dataset Preview</h2>

            <div className="overflow-auto">

              <table className="min-w-full bg-white border">

                <thead>

                  <tr>

                    {preview.columns.map(col => (

                      <th key={col} className="border px-4 py-2 bg-gray-50">
                        {col}
                      </th>

                    ))}

                  </tr>

                </thead>

                <tbody>

                  {preview.preview.map((row, i) => (

                    <tr key={i}>

                      {preview.columns.map(col => (

                        <td key={col} className="border px-4 py-2">
                          {row[col]}
                        </td>

                      ))}

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        )}

      </div>

    </div>

  )

}

export default App
