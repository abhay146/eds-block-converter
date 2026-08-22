import { useState } from 'react';
import './App.css';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:3002/api/convert';


function App() {

  const [file, setFile] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const [error, setError] =
    useState('');

  const [darkMode, setDarkMode] =
    useState(false);

  const [activeBlock, setActiveBlock] =
    useState(null);

  const [activeView, setActiveView] =
    useState('json');

  const [copied, setCopied] =
    useState(false);


  /**
   * File select.
   */
  const handleFileChange =
    (event) => {

      const selectedFile =
        event.target.files?.[0];

      setError('');
      setResult(null);
      setActiveBlock(null);

      if (!selectedFile) {
        setFile(null);
        return;
      }

      if (
        !selectedFile.name
          .toLowerCase()
          .endsWith('.docx')
      ) {

        setFile(null);

        setError(
          'Please select a DOCX file.',
        );

        return;
      }

      setFile(selectedFile);
    };


  /**
   * Convert.
   */
  const handleConvert =
    async () => {

      if (!file) {

        setError(
          'Please select a DOCX file first.',
        );

        return;
      }

      setLoading(true);
      setError('');
      setResult(null);

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
            data.error ||
            'Conversion failed.',
          );
        }


        setResult(data);

        if (
          data.detectedBlocks?.length
        ) {

          setActiveBlock(
            data.detectedBlocks[0],
          );
        }

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : 'Something went wrong.',
        );

      } finally {

        setLoading(false);
      }
    };


  /**
   * Copy.
   */
  const copyText =
    async (text) => {

      try {

        await navigator.clipboard
          .writeText(text);

        setCopied(true);

        setTimeout(
          () => setCopied(false),
          1500,
        );

      } catch {
        setError(
          'Unable to copy content.',
        );
      }
    };


  /**
   * Download.
   */
  const downloadFile =
    (
      content,
      filename,
      type,
    ) => {

      const blob =
        new Blob(
          [content],
          { type },
        );

      const url =
        URL.createObjectURL(
          blob,
        );

      const link =
        document.createElement(
          'a',
        );

      link.href = url;
      link.download = filename;

      document.body.appendChild(
        link,
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url,
      );
    };


  /**
   * Download JSON for one block.
   */
  const downloadBlockJson =
    (block) => {

      const json =
        JSON.stringify(
          {
            title: block.title,
            id: block.id,
            fields: block.fields,
            xwalk: {
              definitions: [
                result.xwalk.definitions.find(
                  (item) =>
                    item.id === block.id,
                ),
              ],

              models: [
                result.xwalk.models.find(
                  (item) =>
                    item.id === block.id,
                ),
              ],

              filters: [],
            },
          },
          null,
          2,
        );


      downloadFile(
        json,
        `${block.id}.json`,
        'application/json',
      );
    };


  /**
   * Download HTML for one block.
   */
  const downloadBlockHtml =
    (block) => {

      downloadFile(
        formatHtml(
          block.html || '',
        ),

        `${block.id}.html`,

        'text/html',
      );
    };


  /**
   * JSON shown in editor.
   */
  const getJson =
    () => {

      if (!activeBlock || !result) {
        return '{}';
      }


      const definition =
        result.xwalk.definitions.find(
          (item) =>
            item.id === activeBlock.id,
        );


      const model =
        result.xwalk.models.find(
          (item) =>
            item.id === activeBlock.id,
        );


      return JSON.stringify(
        {
          definitions: definition
            ? [definition]
            : [],

          models: model
            ? [model]
            : [],

          filters: [],
        },

        null,

        2,
      );
    };


  /**
   * HTML shown in editor.
   */
  const getHtml =
    () => {

      if (!activeBlock) {
        return '';
      }

      return formatHtml(
        activeBlock.html || '',
      );
    };


  /**
   * Document source.
   */
  const getSource =
    () => {

      if (!activeBlock) {
        return '';
      }

      return JSON.stringify(
        activeBlock.source || [],
        null,
        2,
      );
    };


  return (
    <div
      className={
        darkMode
          ? 'app dark'
          : 'app'
      }
    >

      {/* HEADER */}

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
              !darkMode,
            )
          }
        >
          {darkMode
            ? '☀ Light'
            : '◐ Dark'}
        </button>

      </header>


      {/* MAIN */}

      <main className="workspace">


        {/* LEFT */}

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

                <span>📄</span>

                {file.name}

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
                  {result.detectedBlocks?.length ||
                    0}
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

                    <span>

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


        {/* RIGHT */}

        <section className="content">


          {!result && (

            <div className="empty-state">

              <div>
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


          {result &&
            activeBlock && (

            <>

              {/* BLOCK HEADER */}

              <div className="content-header">

                <div>

                  <div className="eyebrow">
                    BLOCK
                  </div>

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


                <button
                  className={
                    activeView ===
                    'source'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setActiveView(
                      'source',
                    )
                  }
                >
                  Document Source
                </button>

              </div>


              {/* CODE */}

              <div className="code-card">

                <div className="code-toolbar">

                  <span>

                    {activeView ===
                      'json' &&
                      `${activeBlock.id}.json`}

                    {activeView ===
                      'html' &&
                      `${activeBlock.id}.html`}

                    {activeView ===
                      'source' &&
                      'document-source.json'}

                  </span>


                  <button
                    onClick={() => {

                      const text =
                        activeView ===
                        'json'
                          ? getJson()
                          : activeView ===
                            'html'
                            ? getHtml()
                            : getSource();

                      copyText(text);
                    }}
                  >
                    {copied
                      ? '✓ Copied'
                      : 'Copy'}
                  </button>

                </div>


                <pre className="code">

                  {activeView ===
                    'json' &&
                    getJson()}

                  {activeView ===
                    'html' &&
                    getHtml()}

                  {activeView ===
                    'source' &&
                    getSource()}

                </pre>

              </div>


              {/* FIELDS */}

              <div className="fields-panel">

                <h3>
                  Detected Fields
                </h3>


                <div className="fields-grid">

                  {activeBlock.fields?.map(
                    (field) => (

                      <div
                        className="field-card"
                        key={field.name}
                      >

                        <strong>
                          {field.name}
                        </strong>

                        <span>
                          {field.component}
                        </span>

                      </div>

                    ),
                  )}

                </div>

              </div>

            </>
          )}

        </section>

      </main>

    </div>
  );
}


/**
 * Simple HTML formatter.
 *
 * This is only for display/download.
 */
function formatHtml(html) {

  if (!html) {
    return '';
  }

  return html
    .replace(
      />\s*</g,
      '>\n<',
    )
    .replace(
      /<\/div>/g,
      '</div>\n',
    )
    .replace(
      /\n{3,}/g,
      '\n\n',
    )
    .trim();
}


export default App;