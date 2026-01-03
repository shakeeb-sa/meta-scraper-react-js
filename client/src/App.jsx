import { useState } from 'react';
import './App.css';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, ExternalHyperlink } from 'docx';
import { saveAs } from 'file-saver';

function App() {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      alert('Please paste some URLs.');
      return;
    }

    setLoading(true);
    setResults([]);
    setError('');
    
    // Split by new lines, commas, or spaces
    const urls = inputText.split(/[\n, ]+/).filter(url => url.length > 0);

    try {
      // In production (Vercel), /api/scrape will work automatically.
      // Locally, you might need the full localhost URL if not using a proxy.
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

      const responseData = await response.json();
      setResults(responseData.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSuccessfulResults = () => results.filter(r => r.status === 'success');

  // Download Handlers
  const downloadTxt = () => {
    const data = getSuccessfulResults().map(item => item.result).join('\n\n');
    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'meta_results.txt');
  };

  const downloadXlsx = () => {
    const data = getSuccessfulResults().map(item => {
      const parts = item.result.split(';');
      return { 
        Title: parts[0] ? parts[0].trim() : '', 
        Description: parts.slice(1).join(';').trim() || '' 
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Meta Results");
    XLSX.writeFile(wb, "meta_results.xlsx");
  };

  const downloadDocx = async () => {
    const paragraphs = getSuccessfulResults().flatMap(item => [
      new Paragraph({
        children: [
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: item.url,
                style: "Hyperlink",
              }),
            ],
            link: item.url,
          }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: item.result, size: 22 })],
      }),
      new Paragraph({ text: "" })
    ]);

    const doc = new Document({
      sections: [{ children: paragraphs }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'meta_results.docx');
  };

  return (
    <div className="container">
      <h1>Meta Title & Description Scraper</h1>
      <p>Paste your URLs below (one per line). Duplicates are removed automatically.</p>
      
      <textarea 
        rows="10" 
        placeholder="https://www.example.com..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
      ></textarea>
      
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate'}
      </button>

      {/* Download Buttons */}
      {getSuccessfulResults().length > 0 && (
        <div className="download-container">
          <h3>Download Results</h3>
          <button className="download-btn" onClick={downloadTxt}>Download .txt</button>
          <button className="download-btn" onClick={downloadDocx}>Download .docx</button>
          <button className="download-btn" onClick={downloadXlsx}>Download .xlsx</button>
        </div>
      )}

      {loading && <div className="loader"></div>}
      
      {error && <div className="result-item error"><strong>Error:</strong> {error}</div>}

      <div className="results-container">
        {results.map((item, index) => (
          <div key={index} className={`result-item ${item.status}`}>
            <strong>{item.url}</strong>
            {item.status === 'success' ? item.result : `Failed: ${item.reason}`}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;