import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:3002/api/convert';

function formatJson(data) {
  if (!data) return '';

  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function formatHtml(html) {
  if (!html) return '';

  let formatted = html
    .replace(/>\s*</g, '><')
    .replace(/></g, '>\n<');

  const lines = formatted.split('\n');

  let indent = 0;

  return lines
    .map((line) => {
      const text = line.trim();

      if (!text) return '';

      if (
        /^<\//.test(text) &&
        indent > 0
      ) {
        indent--;
      }

      const result =
        '  '.repeat(indent) + text;

      if (
        /^<[^/!][^>]*>$/.test(text) &&
        !/<\/[^>]+>$/.test(text) &&
        !/<(img|source|input|br|hr|meta|link)\b/i.test(text)
      ) {
        indent++;
      }

      return result;
    })
    .filter(Boolean)
    .join('\n');
}

function downloadFile(
  content,
  filename,
  type,
) {
  const blob = new Blob(
    [content],
    { type },
  );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);
}

function App() {
  const [file, setFile] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [result, setResult] =
    useState(null);

  const [activeBlock, setActiveBlock] =
    useState(null);

  const [activeView, setActiveView] =
    useState('json');

  const [copied, setCopied] =
    useState(false);

  const [darkMode, setDarkMode] =
    useState(true);

  const [loadingText, setLoadingText] =
    useState('Preparing document...');

  useEffect(() => {
    if (!loading) return;

    const messages = [
      'Reading DOCX document...',
      'Extracting document content...',
      'Detecting EDS blocks...',
      'Generating XWalk fields...',
      'Formatting JSON...',
      'Formatting HTML...',
      'Almost ready...',
    ];

    let index = 0;

    setLoadingText(messages[0]);

    const timer =
      setInterval(() => {
        index =
          (index + 1) %
          messages.length;

        setLoadingText(
          messages[index],
        );
      }, 900);

    return () =>
      clearInterval(timer);
  }, [loading]);

  function handleFileChange(event) {
    const selected =
      event.target.files?.[0];

    setFile(selected || null);
    setError('');
    setResult(null);
    setActiveBlock(null);
  }

  async function handleConvert() {
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);
    setActiveBlock(null);

    try {
      const formData =
        new FormData();

      formData.append(
        'file',
        file,
      );

      const response =
        await fetch(
          API_URL,
          {
            method: 'POST',
            body: formData,
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Conversion failed',
        );
      }

      setResult(data);

      const firstBlock =
        data?.detectedBlocks?.[0];

      if (firstBlock) {
        setActiveBlock(
          firstBlock,
        );
        setActiveView('json');
      }
    } catch (err) {
      setError(
        err?.message ||
        'Something went wrong while converting the document.',
      );
    } finally {
      setLoading(false);
    }
  }

  function getJson() {
    if (!activeBlock) return '';

    return formatJson({
      title:
        activeBlock.title,

      id:
        activeBlock.id,

      fields:
        activeBlock.fields || [],
    });
  }

  function getHtml() {
    if (!activeBlock) return '';

    return formatHtml(
      activeBlock.html || '',
    );
  }

  function copyText(text) {
    if (!text) return;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 1500);
      });
  }

  function downloadBlockJson(
    block,
  ) {
    const content =
      formatJson({
        title: block.title,
        id: block.id,
        fields:
          block.fields || [],
      });

    downloadFile(
      content,
      `${block.id}.json`,
      'application/json',
    );
  }

  function downloadBlockHtml(
    block,
  ) {
    const content =
      formatHtml(
        block.html || '',
      );

    downloadFile(
      content,
      `${block.id}.html`,
      'text/html',
    );
  }

  const currentCode =
    useMemo(() => {
      if (!activeBlock) return '';

      if (activeView === 'json') {
        return getJson();
      }

      return getHtml();
    }, [
      activeBlock,
      activeView,
    ]);

  return (
    <div
      className={
        darkMode
          ? 'app dark'
          : 'app'
      }
    >

      {/* TOP BAR */}

      <header className="topbar">

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

        <button
          className="theme-button"
          onClick={() =>
            setDarkMode(
              (value) => !value,
            )
          }
        >
          {darkMode
            ? '☀ Light'
            : '☾ Dark'}
        </button>

      </header>


      <main className="workspace">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="upload-box">

            <div className="upload-icon">
              ↑
            </div>

            <h2>
              Upload Document
            </h2>

            <p>
              Select a DOCX file to
              generate EDS blocks.
            </p>

            <label className="upload-button">

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
              <div className="file-name">

                <span>
                  📄
                </span>

                <span>
                  {file.name}
                </span>

              </div>
            )}

            <button
              className="convert-button"
              disabled={
                !file ||
                loading
              }
              onClick={
                handleConvert
              }
            >

              {loading
                ? 'Converting...'
                : 'Convert Document'}

            </button>

            {error && (
              <div className="error">
                {error}
              </div>
            )}

          </div>


          {/* BLOCK LIST */}

          {result && (
            <div className="block-list">

              <div className="section-title">

                <span>
                  Detected Blocks
                </span>

                <span className="count">
                  {result.detectedBlocks
                    ?.length || 0}
                </span>

              </div>

              {result.detectedBlocks?.map(
                (block) => (

                  <button
                    key={block.id}
                    className={
                      activeBlock?.id ===
                      block.id
                        ? 'block-item active'
                        : 'block-item'
                    }
                    onClick={() => {

                      setActiveBlock(
                        block,
                      );

                      setActiveView(
                        'json',
                      );

                    }}
                  >

                    <span className="block-symbol">
                      ▦
                    </span>

                    <span className="block-info">

                      <strong>
                        {block.title}
                      </strong>

                      <small>
                        {block.id}
                      </small>

                    </span>

                  </button>

                ),
              )}

            </div>
          )}

        </aside>


        {/* CONTENT */}

        <section className="content">

          {/* LOADER */}

          {loading && (
            <div className="loading-screen">

              <div className="loader-card">

                <div className="loader-logo">
                  E
                </div>

                <div className="loader-spinner" />

                <h2>
                  Converting document
                </h2>

                <p>
                  {loadingText}
                </p>

                <div className="loader-track">

                  <div className="loader-progress" />

                </div>

                <span className="loader-hint">
                  Please wait while your
                  EDS blocks are generated
                </span>

              </div>

            </div>
          )}


          {/* EMPTY */}

          {!result &&
            !loading && (
              <div className="empty-state">

                <div className="empty-icon">
                  ◇
                </div>

                <h2>
                  Start by uploading a DOCX
                </h2>

                <p>
                  Your detected blocks,
                  XWalk JSON and HTML
                  will appear here.
                </p>

              </div>
            )}


          {/* RESULT */}

          {result &&
            activeBlock &&
            !loading && (

              <div className="result-view">

                {/* SIMPLE HEADER */}

                <div className="content-header">

                  <div className="block-heading">

                    <h2>
                      {activeBlock.title}
                    </h2>

                    <span className="id-badge">
                      {activeBlock.id}
                    </span>

                  </div>

                  <div className="block-actions">

                    <button
                      onClick={() =>
                        downloadBlockJson(
                          activeBlock,
                        )
                      }
                    >
                      ↓ JSON
                    </button>

                    <button
                      onClick={() =>
                        downloadBlockHtml(
                          activeBlock,
                        )
                      }
                    >
                      ↓ HTML
                    </button>

                  </div>

                </div>


                {/* TABS */}

                <div className="tabs">

                  <button
                    className={
                      activeView ===
                      'json'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setActiveView(
                        'json',
                      )
                    }
                  >
                    JSON
                  </button>

                  <button
                    className={
                      activeView ===
                      'html'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setActiveView(
                        'html',
                      )
                    }
                  >
                    HTML
                  </button>

                </div>


                {/* CODE */}

                <div className="code-card">

                  <div className="code-toolbar">

                    <div className="file-label">

                      <span className="file-dot">
                        ●
                      </span>

                      {activeView ===
                        'json'
                        ? `${activeBlock.id}.json`
                        : `${activeBlock.id}.html`}

                    </div>

                    <button
                      onClick={() =>
                        copyText(
                          currentCode,
                        )
                      }
                    >
                      {copied
                        ? '✓ Copied'
                        : 'Copy'}
                    </button>

                  </div>

                  <pre className="code">
                    <code>
                      {currentCode}
                    </code>
                  </pre>

                </div>


                {/* FIELDS */}

                <div className="fields-panel">

                  <div className="fields-header">

                    <div>
                      <h3>
                        Detected Fields
                      </h3>

                      <p>
                        Fields detected from
                        the selected block
                      </p>
                    </div>

                    <span className="field-count">
                      {activeBlock.fields
                        ?.length || 0}
                    </span>

                  </div>


                  <div className="fields-grid">

                    {activeBlock.fields?.map(
                      (field) => (

                        <div
                          className="field-card"
                          key={
                            field.name
                          }
                        >

                          <div className="field-top">

                            <strong>
                              {field.name}
                            </strong>

                            <span>
                              {field.component}
                            </span>

                          </div>

                          <small>
                            {field.label}
                          </small>

                        </div>

                      ),
                    )}

                  </div>

                </div>

              </div>
            )}

        </section>

      </main>

    </div>
  );
}

export default App;