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
    
    const urls = inputText.split(/[\n, ]+/).filter(url => url.length > 0);

    try {
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

  // --- Download Handlers ---
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
            children: [new TextRun({ text: item.url, style: "Hyperlink" })],
            link: item.url,
          }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: item.result, size: 22 })],
      }),
      new Paragraph({ text: "" })
    ]);

    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'meta_results.docx');
  };

  return (
    <div className="app-layout">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="logo-icon">M</div>
          <span>MetaScraper<span className="pro-badge">PRO</span></span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="card input-card">
          <div className="card-header">
            <h2>Bulk URL Processor</h2>
            <p className="subtitle">Paste your links below to extract Titles & Descriptions automatically.</p>
          </div>
          
          <textarea 
            className="input-area"
            rows="8" 
            placeholder="Paste URLs here (https://example.com)&#10;One per line..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          ></textarea>
          
          <div className="action-bar">
            <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <span className="loader-text">Processing...</span>
              ) : (
                'Generate Meta Data'
              )}
            </button>
          </div>

          {error && <div className="error-banner">{error}</div>}
        </div>

        {/* Results Section */}
        {(results.length > 0 || loading) && (
          <div className="results-wrapper">
             <div className="results-header">
                <h3>Results ({results.length})</h3>
                {getSuccessfulResults().length > 0 && (
                  <div className="download-actions">
                    <button className="btn btn-outline" onClick={downloadTxt}>TXT</button>
                    <button className="btn btn-outline" onClick={downloadDocx}>DOCX</button>
                    <button className="btn btn-outline" onClick={downloadXlsx}>EXCEL</button>
                  </div>
                )}
             </div>

            {loading && <div className="loading-spinner"></div>}

            <div className="results-list">
              {results.map((item, index) => (
                <div key={index} className={`result-card ${item.status}`}>
                  <div className="result-icon">
                    {item.status === 'success' ? '✅' : '⚠️'}
                  </div>
                  <div className="result-content">
                    <a href={item.url} target="_blank" rel="noreferrer" className="result-url">{item.url}</a>
                    <div className="result-text">
                      {item.status === 'success' ? item.result : <span className="error-text">{item.reason}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;