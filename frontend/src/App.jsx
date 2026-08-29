import { useMemo, useState } from 'react';
import './App.css';

const API_URL =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3002/api/convert'
    : 'https://eds-block-converter.onrender.com/api/convert';

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('json');

  const blockFiles = useMemo(() => {
    if (!result || !Array.isArray(result.blockFiles)) {
      return [];
    }

    return result.blockFiles;
  }, [result]);

  const selectedBlock =
    blockFiles[selectedBlockIndex] || null;

  const handleFileChange = (event) => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (
      !selectedFile.name
        .toLowerCase()
        .endsWith('.docx')
    ) {
      setError(
        'Only DOCX files are supported.'
      );

      setFile(null);
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setError('');
    setSelectedBlockIndex(0);
    setActiveTab('json');
  };

  const handleConvert = async () => {
    if (!file) {
      setError(
        'Please select a DOCX file first.'
      );

      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();

      formData.append(
        'file',
        file
      );

      console.log(
        'API URL:',
        API_URL
      );

      const response =
        await fetch(API_URL, {
          method: 'POST',
          body: formData,
          cache: 'no-store',
        });

      const responseText =
        await response.text();

      console.log(
        'RAW BACKEND RESPONSE:'
      );

      console.log(
        responseText
      );

      let backendData;

      try {
        backendData =
          JSON.parse(
            responseText
          );
      } catch {
        throw new Error(
          responseText ||
            'Backend did not return valid JSON.'
        );
      }

      if (!response.ok) {
        throw new Error(
          backendData?.error ||
            backendData?.message ||
            `Request failed with status ${response.status}`
        );
      }

      /*
       * IMPORTANT
       *
       * Backend response ko EXACTLY
       * as it is save kar rahe hain.
       *
       * No transformation.
       * No field rename.
       * No field delete.
       * No merge.
       */

      console.log(
        'EXACT PARSED BACKEND DATA:'
      );

      console.log(
        backendData
      );

      setResult(
        backendData
      );

      setSelectedBlockIndex(0);

      setActiveTab(
        'json'
      );
    } catch (err) {
      console.error(
        'Conversion error:',
        err
      );

      setError(
        err?.message ||
          'Something went wrong while converting the document.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setSelectedBlockIndex(0);
    setActiveTab('json');
  };

  const selectBlock = (index) => {
    setSelectedBlockIndex(index);
    setActiveTab('json');
  };

  const downloadFile = (
    content,
    filename,
    type
  ) => {
    if (
      content === undefined ||
      content === null
    ) {
      return;
    }

    const blob =
      new Blob(
        [
          typeof content === 'string'
            ? content
            : JSON.stringify(
                content,
                null,
                2
              ),
        ],
        {
          type,
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      filename;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );
  };

  const copyContent = async () => {
    if (!selectedBlock) {
      return;
    }

    const content =
      activeTab === 'json'
        ? JSON.stringify(
            selectedBlock.json,
            null,
            2
          )
        : selectedBlock.html || '';

    try {
      await navigator.clipboard.writeText(
        content
      );
    } catch (err) {
      console.error(
        'Copy failed:',
        err
      );
    }
  };

  const jsonContent =
    selectedBlock?.json
      ? JSON.stringify(
          selectedBlock.json,
          null,
          2
        )
      : '';

  const htmlContent =
    selectedBlock?.html || '';

  return (
    <div className="app">
      {/* =========================
          HEADER
      ========================= */}

      <header className="top-header">
        <div className="brand">
          <div className="brand-icon">
            E
          </div>

          <div>
            <h1>
              EDS Block Converter
            </h1>

            <p>
              DOCX → EDS HTML + XWalk
            </p>
          </div>
        </div>
      </header>

      {/* =========================
          MAIN LAYOUT
      ========================= */}

      <div className="workspace">
        {/* =========================
            LEFT SIDEBAR
        ========================= */}

        <aside className="sidebar">
          <div className="upload-card">
            <div className="upload-icon">
              ↑
            </div>

            <h2>
              Upload Document
            </h2>

            <p>
              Select a DOCX file to generate EDS blocks.
            </p>

            <label className="choose-button">
              Choose DOCX

              <input
                type="file"
                accept=".docx"
                onChange={
                  handleFileChange
                }
              />
            </label>

            {file && (
              <div className="file-info">
                <div className="docx-icon">
                  DOCX
                </div>

                <span>
                  {file.name}
                </span>
              </div>
            )}

            <button
              type="button"
              className="convert-button"
              onClick={
                handleConvert
              }
              disabled={
                !file ||
                loading
              }
            >
              {loading
                ? 'Converting...'
                : 'Convert Document'}
            </button>

            {result && (
              <button
                type="button"
                className="reset-button"
                onClick={
                  handleReset
                }
              >
                Reset
              </button>
            )}

            {error && (
              <div className="error-box">
                {error}
              </div>
            )}
          </div>

          {/* =========================
              DETECTED BLOCKS
          ========================= */}

          {blockFiles.length > 0 && (
            <div className="blocks-section">
              <div className="blocks-heading">
                <span>
                  DETECTED BLOCKS
                </span>

                <span className="block-count">
                  {blockFiles.length}
                </span>
              </div>

              <div className="blocks-list">
                {blockFiles.map(
                  (
                    block,
                    index
                  ) => (
                    <button
                      type="button"
                      key={`${block.name}-${index}`}
                      className={`block-item ${
                        selectedBlockIndex ===
                        index
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        selectBlock(
                          index
                        )
                      }
                    >
                      <div className="block-item-icon">
                        ▦
                      </div>

                      <div className="block-item-content">
                        <strong>
                          {block.json?.title ||
                            block.name ||
                            `Block ${index + 1}`}
                        </strong>

                        <span>
                          {block.json?.id ||
                            block.name ||
                            'block'}
                        </span>
                      </div>

                      <div className="arrow">
                        →
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </aside>

        {/* =========================
            CONTENT
        ========================= */}

        <main className="content">
          {loading && (
            <div className="loading-state">
              <div className="loader" />

              <p>
                Converting your document...
              </p>
            </div>
          )}

          {!loading &&
            !result && (
              <div className="empty-state">
                <div className="empty-icon">
                  E
                </div>

                <h2>
                  Upload a DOCX document
                </h2>

                <p>
                  Converted blocks will appear here.
                </p>
              </div>
            )}

          {!loading &&
            selectedBlock && (
              <>
                {/* =========================
                    BLOCK HEADER
                ========================= */}

                <div className="content-header">
                  <div>
                    <p className="content-label">
                      BLOCK NAME
                    </p>

                    <h2>
                      {selectedBlock.json?.title ||
                        selectedBlock.name ||
                        'Block'}
                    </h2>

                    <span className="block-id">
                      {selectedBlock.json?.id ||
                        selectedBlock.name ||
                        'block'}
                    </span>
                  </div>

                  <div className="download-actions">
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(
                          selectedBlock.json,
                          selectedBlock.jsonFile ||
                            `${selectedBlock.name}.json`,
                          'application/json'
                        )
                      }
                    >
                      ⇩ JSON
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(
                          selectedBlock.html ||
                            '',
                          selectedBlock.htmlFile ||
                            `${selectedBlock.name}.html`,
                          'text/html'
                        )
                      }
                    >
                      ⇩ HTML
                    </button>
                  </div>
                </div>

                {/* =========================
                    TABS
                ========================= */}

                <div className="tabs">
                  <button
                    type="button"
                    className={
                      activeTab ===
                      'json'
                        ? 'tab active-tab'
                        : 'tab'
                    }
                    onClick={() =>
                      setActiveTab(
                        'json'
                      )
                    }
                  >
                    {'{}'} JSON
                  </button>

                  <button
                    type="button"
                    className={
                      activeTab ===
                      'html'
                        ? 'tab active-tab'
                        : 'tab'
                    }
                    onClick={() =>
                      setActiveTab(
                        'html'
                      )
                    }
                  >
                    {'</>'} HTML
                  </button>
                </div>

                {/* =========================
                    CODE WINDOW
                ========================= */}

                <div className="code-window">
                  <div className="code-window-header">
                    <div className="code-file-info">
                      <div className="window-dots">
                        <span />
                        <span />
                        <span />
                      </div>

                      <span className="code-type">
                        {activeTab ===
                        'json'
                          ? 'JSON'
                          : 'HTML'}
                      </span>

                      <span className="code-filename">
                        {activeTab ===
                        'json'
                          ? selectedBlock.jsonFile ||
                            `${selectedBlock.name}.json`
                          : selectedBlock.htmlFile ||
                            `${selectedBlock.name}.html`}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="copy-button"
                      onClick={
                        copyContent
                      }
                    >
                      Copy
                    </button>
                  </div>

                  <div className="code-content">
                    <pre>
                      <code>
                        {activeTab ===
                        'json'
                          ? jsonContent
                          : htmlContent}
                      </code>
                    </pre>
                  </div>
                </div>
              </>
            )}
        </main>
      </div>
    </div>
  );
}

export default App;