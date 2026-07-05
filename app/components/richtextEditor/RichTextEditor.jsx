import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import "./RichTextEditor.css";

/**
 * @typedef {Object} FeatureFlags
 *
 * ON by default (core toolbar) — set false to hide:
 * @property {boolean} [undo=true]           - Undo button — Ctrl+Z
 * @property {boolean} [redo=true]           - Redo button — Ctrl+Y
 * @property {boolean} [headings=true]       - Block format dropdown (Paragraph / H1–H4 / Preformat)
 * @property {boolean} [bold=true]           - Bold — Ctrl+B
 * @property {boolean} [italic=true]         - Italic — Ctrl+I
 * @property {boolean} [underline=true]      - Underline — Ctrl+U
 * @property {boolean} [unorderedList=true]  - Bullet list
 * @property {boolean} [orderedList=true]    - Numbered list
 * @property {boolean} [align=true]          - Left / Center / Right / Justify alignment buttons
 * @property {boolean} [image=true]          - Insert image via URL; supports resize & drag-move in editor
 * @property {boolean} [imageUpload=true]    - Upload tab inside the image modal (requires image: true)
 * @property {boolean} [codeView=true]       - Toggle raw HTML source textarea
 * @property {boolean} [wordCount=true]      - Live word count in the footer bar
 *
 * OFF by default — set true to enable:
 * @property {boolean} [fontFamily=false]    - Font family picker dropdown
 * @property {boolean} [strikethrough=false] - Strikethrough text
 * @property {boolean} [textColor=false]     - Foreground text color picker
 * @property {boolean} [highlight=false]     - Background highlight color picker (toolbar input)
 * @property {boolean} [bgHighlight=false]   - Add/remove background color on current selection
 * @property {boolean} [superscript=false]   - Superscript (x²)
 * @property {boolean} [subscript=false]     - Subscript (x₂)
 * @property {boolean} [indent=false]        - Indent & outdent buttons
 * @property {boolean} [link=false]          - Insert / edit hyperlinks
 * @property {boolean} [table=false]         - Insert table via modal (max 20 rows × 12 cols)
 * @property {boolean} [codeBlock=false]     - Insert a <pre><code> fenced code block
 * @property {boolean} [blockquote=false]    - Wrap current paragraph in <blockquote>
 * @property {boolean} [hr=false]            - Insert a horizontal rule <hr>
 * @property {boolean} [clearFormat=false]   - Strip all inline formatting from the selection
 * @property {boolean} [charCount=false]     - Live character count in the footer bar
 * @property {boolean} [imageCount=false]    - Live image count in the footer bar
 *
 * @example
 * // Enable a few extra features
 * features: { link: true, table: true, strikethrough: true, charCount: true }
 *
 * @example
 * // Hide something that is on by default
 * features: { image: false, codeView: false }
 */

/**
 * @typedef {Object} EditorConfig
 * @property {string}                  [placeholder="Start writing..."]  - Empty-state placeholder text shown when the editor is empty.
 * @property {number}                  [height=450]                      - Fixed content-area height in px. Ignored when minHeight or maxHeight is set.
 * @property {number|null}             [minHeight=null]                  - Min content-area height in px; editor grows with content up to maxHeight.
 * @property {number|null}             [maxHeight=null]                  - Max content-area height in px; content scrolls beyond this.
 * @property {string}                  [width="100%"]                    - CSS width of the editor wrapper — any valid CSS value e.g. "800px", "60%".
 * @property {string}                  [defaultValue=""]                 - Initial HTML injected once on mount. Not reactive after mount — use for templates/defaults.
 * @property {number|null}             [maxLength=null]                  - Max character count; further typing and paste are blocked when reached. e.g. 2000
 * @property {string|null}             [formId=null]                     - ID of a <form> element to associate with; injects a hidden input so the editor value is submitted with the form.
 * @property {string}                  [name="richtext"]                 - name attribute of the hidden input (only used when formId is set).
 * @property {boolean}                 [pasteClearFont=false]            - Strip font-family and font-size from pasted content.
 * @property {boolean}                 [pasteClearColor=true]            - Strip background-color and text color from pasted content. Set false to preserve original colors.
 * @property {"left"|"center"|"right"} [footerAlign="right"]            - Alignment of the stats badges in the footer bar.
 * @property {FeatureFlags}            [features]                        - Toggle individual toolbar buttons and footer stats on/off.
 *
 * @example
 * // Fixed height (default behaviour)
 * config={{ height: 300 }}
 *
 * @example
 * // Auto-grow with a max ceiling
 * config={{ minHeight: 200, maxHeight: 600 }}
 *
 * @example
 * // Character limit with visible counter
 * config={{ maxLength: 2000, features: { charCount: true } }}
 *
 * @example
 * // Associate with a native <form> so the HTML is submitted automatically
 * config={{ formId: "my-form", name: "body" }}
 *
 * @example
 * // Full kitchen-sink config
 * config={{
 *   placeholder: "Start writing...",
 *   minHeight: 300,
 *   maxHeight: 600,
 *   width: "100%",
 *   maxLength: 5000,
 *   footerAlign: "left",
 *   pasteClearFont: false,
 *   pasteClearColor: true,
 *   features: {
 *     link: true,
 *     table: true,
 *     strikethrough: true,
 *     textColor: true,
 *     highlight: true,
 *     bgHighlight: true,
 *     superscript: true,
 *     subscript: true,
 *     indent: true,
 *     codeBlock: true,
 *     blockquote: true,
 *     hr: true,
 *     clearFormat: true,
 *     charCount: true,
 *     imageCount: true,
 *   },
 * }}
 */

/**
 * Full default config — spread to override specific values.
 * @type {EditorConfig}
 */
export const DEFAULT_CONFIG = {
    placeholder: "Start writing...",
    height: 450,
    minHeight: null,
    maxHeight: null,
    width: "100%",
    defaultValue: "",
    maxLength: null,
    formId: null,
    name: "richtext",
    pasteClearFont: false,
    pasteClearColor: true,
    footerAlign: "right",
    features: {
        // ── Always-on core ────────────────────────────────────────────
        undo: true,
        redo: true,
        headings: true,       // Paragraph / H1–H4 / Preformat dropdown
        fontSize: false,      // font size input (removed — use heading styles instead)
        bold: true,
        italic: true,
        underline: true,
        unorderedList: true,
        orderedList: true,
        align: true,
        image: true,
        codeView: true,       // HTML source toggle
        wordCount: true,
        // ── Off by default — enable via config.features ───────────────
        fontFamily: false,
        strikethrough: false,
        textColor: false,
        highlight: false,
        bgHighlight: false,
        superscript: false,
        subscript: false,
        indent: false,
        link: false,
        table: false,
        imageUpload: true,         // upload tab inside image modal (requires image: true)
        codeBlock: false,
        blockquote: false,
        hr: false,
        clearFormat: false,
        charCount: false,
        imageCount: false,
    },
};

// ─── Height style helper ───────────────────────────────────────────────────────
function contentHeightStyle(cfg) {
    if (cfg.minHeight || cfg.maxHeight) {
        return {
            minHeight: cfg.minHeight ? `${cfg.minHeight}px` : undefined,
            maxHeight: cfg.maxHeight ? `${cfg.maxHeight}px` : undefined,
            overflowY: cfg.maxHeight ? "auto" : "visible",
        };
    }
    return { height: `${cfg.height}px`, overflowY: "auto" };
}

// ─── Portal ────────────────────────────────────────────────────────────────────
function Portal({ children }) {
    if (typeof document === "undefined") return null;
    return createPortal(children, document.body);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════════════════════════════════════════

function TableModal({ onInsert, onClose }) {
    const [rows, setRows] = useState(2);
    const [cols, setCols] = useState(2);
    return (
        <Portal>
            <div className="jhrte-overlay-v1" onClick={onClose}>
                <div className="jhrte-modal-v1" onClick={(e) => e.stopPropagation()}>
                    <div className="jhrte-modal-title-v1">Insert Table</div>
                    {[["Rows", rows, setRows, 20], ["Columns", cols, setCols, 12]].map(([label, val, set, max]) => (
                        <div key={label} className="jhrte-modal-row-v1">
                            <label className="jhrte-modal-label-v1">{label}</label>
                            <div className="jhrte-counter-v1">
                                <button className="jhrte-counter-btn-v1" onClick={() => set(Math.max(1, val - 1))}>−</button>
                                <span className="jhrte-counter-val-v1">{val}</span>
                                <button className="jhrte-counter-btn-v1" onClick={() => set(Math.min(max, val + 1))}>+</button>
                            </div>
                        </div>
                    ))}
                    <div className="jhrte-preview-grid-v1">
                        {Array.from({ length: Math.min(rows, 5) }).map((_, r) => (
                            <div key={r} className="jhrte-preview-row-v1">
                                {Array.from({ length: Math.min(cols, 7) }).map((_, c) => (
                                    <div key={c} className="jhrte-preview-cell-v1" />
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="jhrte-modal-actions-v1">
                        <button className="jhrte-modal-cancel-v1" onClick={onClose}>Cancel</button>
                        <button className="jhrte-modal-confirm-v1" onClick={() => { onInsert(rows, cols); onClose(); }}>
                            Insert {rows}×{cols}
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}

function ImageModal({ onInsert, onClose, showUpload = true }) {
    const [tab, setTab] = useState("url");
    const [url, setUrl] = useState("");
    const [width, setWidth] = useState(300);
    const fileRef = useRef();

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { setUrl(ev.target.result); setTab("url"); };
        reader.readAsDataURL(file);
    };

    return (
        <Portal>
            <div className="jhrte-overlay-v1" onClick={onClose}>
                <div className="jhrte-modal-v1" onClick={(e) => e.stopPropagation()}>
                    <div className="jhrte-modal-title-v1">Insert Image</div>
                    {showUpload && (
                        <div className="jhrte-tabs-v1">
                            {["url", "upload"].map((t) => (
                                <button key={t} className={`jhrte-tab-v1${tab === t ? " jhrte-tab-active-v1" : ""}`} onClick={() => setTab(t)}>
                                    {t === "url" ? "URL" : "Upload"}
                                </button>
                            ))}
                        </div>
                    )}
                    {(!showUpload || tab === "url") ? (
                        <input className="jhrte-modal-input-v1" placeholder="https://example.com/image.jpg"
                            value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
                    ) : (
                        <div className="jhrte-upload-area-v1" onClick={() => fileRef.current.click()}>
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
                            Click to select image from device
                        </div>
                    )}
                    {url && <img src={url} alt="preview" className="jhrte-img-preview-v1" />}
                    <div className="jhrte-modal-row-v1">
                        <label className="jhrte-modal-label-v1">Initial width (px)</label>
                        <input className="jhrte-modal-input-v1 jhrte-modal-input-sm-v1" type="number"
                            value={width} min={40} onChange={(e) => setWidth(Number(e.target.value))} />
                    </div>
                    <div className="jhrte-modal-actions-v1">
                        <button className="jhrte-modal-cancel-v1" onClick={onClose}>Cancel</button>
                        <button className="jhrte-modal-confirm-v1" disabled={!url}
                            onClick={() => { if (url) { onInsert(url, width); onClose(); } }}>Insert</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}

function LinkModal({ onInsert, onClose, mode = "insert", initialUrl = "https://", initialText = "" }) {
    const [url, setUrl] = useState(initialUrl);
    const [text, setText] = useState(initialText);
    return (
        <Portal>
            <div className="jhrte-overlay-v1" onClick={onClose}>
                <div className="jhrte-modal-v1" onClick={(e) => e.stopPropagation()}>
                    <div className="jhrte-modal-title-v1">{mode === "edit" ? "Edit Link" : "Insert Link"}</div>
                    <div>
                        <label className="jhrte-modal-label-v1" style={{ display: "block", marginBottom: 6 }}>Display text</label>
                        <input className="jhrte-modal-input-v1" placeholder="Link text (optional)"
                            value={text} onChange={(e) => setText(e.target.value)} />
                    </div>
                    <div>
                        <label className="jhrte-modal-label-v1" style={{ display: "block", marginBottom: 6 }}>URL</label>
                        <input className="jhrte-modal-input-v1" placeholder="https://"
                            value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
                    </div>
                    <div className="jhrte-modal-actions-v1">
                        <button className="jhrte-modal-cancel-v1" onClick={onClose}>Cancel</button>
                        <button className="jhrte-modal-confirm-v1" disabled={!url}
                            onClick={() => { if (url) { onInsert(url, text); onClose(); } }}>
                            {mode === "edit" ? "Update" : "Insert"}
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TOOLBAR PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function ToolBtn({ title, onClick, active, disabled, children, "data-id": dataId }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            data-id={dataId}
            className={`jhrte-btn-v1${active ? " jhrte-btn-active-v1" : ""}${disabled ? " jhrte-btn-disabled-v1" : ""}`}
        >
            {children}
        </button>
    );
}

function ToolSelect({ onChange, children, title, className = "", disabled }) {
    const ref = useRef();
    return (
        <select
            ref={ref}
            title={title}
            disabled={disabled}
            className={`jhrte-select-v1 ${className}${disabled ? " jhrte-select-disabled-v1" : ""}`}
            onChange={(e) => { onChange(e.target.value); ref.current.selectedIndex = 0; }}
        >
            {children}
        </select>
    );
}

function Divider() { return <div className="jhrte-divider-v1" />; }

// ─── Background Highlight Button ───────────────────────────────────────────────
// Lets user apply a background color to selection (like pasted bg colors),
// or remove all background colors from selection.
function BgHighlightBtn({ disabled, exec, saveSelection, restoreSelection }) {
    const [color, setColor] = useState("#ffff00");
    const [active, setActive] = useState(false);

    // Check if selection has any background color
    const checkActive = useCallback(() => {
        const sel = window.getSelection();
        if (!sel?.rangeCount) { setActive(false); return; }
        let node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        // Walk up to find any background-color styling
        while (node && node.nodeType === Node.ELEMENT_NODE) {
            const bg = node.style?.backgroundColor;
            if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
                setActive(true);
                return;
            }
            node = node.parentNode;
        }
        setActive(false);
    }, []);

    useEffect(() => {
        document.addEventListener("selectionchange", checkActive);
        return () => document.removeEventListener("selectionchange", checkActive);
    }, [checkActive]);

    const applyBg = useCallback((c) => {
        exec("hiliteColor", c);
    }, [exec]);

    const removeBg = useCallback(() => {
        // Remove background from all spans/elements in selection
        exec("hiliteColor", "transparent");
        // Also strip inline background-color from any selected elements
        const sel = window.getSelection();
        if (!sel?.rangeCount) return;
        const range = sel.getRangeAt(0);
        const fragment = range.cloneContents();
        const allEls = fragment.querySelectorAll("*");
        allEls.forEach(el => { el.style.backgroundColor = ""; });
        // Apply via execCommand for the highlight removal
        document.execCommand("removeFormat", false, null);
        // Re-apply: execCommand removeFormat kills text color too, so re-exec hiliteColor transparent
        exec("hiliteColor", "transparent");
    }, [exec]);

    return (
        <div className="jhrte-bghighlight-wrap-v1" title="Selection background color">
            <ToolBtn
                title={active ? "Remove background color from selection" : "Apply background color to selection"}
                disabled={disabled}
                active={active}
                onClick={() => {
                    if (active) {
                        removeBg();
                    } else {
                        applyBg(color);
                    }
                }}
            >
                <span className="jhrte-bghighlight-icon-v1" style={{ "--jhrte-bghighlight-color": color }}>▐</span>
            </ToolBtn>
            <label className={`jhrte-bghighlight-swatch-v1${disabled ? " jhrte-color-label-disabled-v1" : ""}`} title="Pick background color">
                <input
                    type="color"
                    value={color}
                    className="jhrte-color-input-v1"
                    disabled={disabled}
                    onChange={(e) => {
                        setColor(e.target.value);
                        applyBg(e.target.value);
                    }}
                />
            </label>
        </div>
    );
}

// ─── Font Size (pixel) Input ───────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN EDITOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RichTextEditor — dependency-free WYSIWYG editor for React.
 *
 * No npm install needed. Copy `RichTextEditor.jsx` and `RichTextEditor.css`
 * into your project, import, and use.
 *
 * @param {Object}                 props
 * @param {string}                 props.value       - Current HTML content (controlled). Pass your state value here.
 * @param {function(string): void} props.setValue    - React setState setter called with the latest HTML on every change. e.g. setHtml
 * @param {function(string): void} [props.onChange]  - Alternative to setValue — also called with the latest HTML string on every change.
 * @param {EditorConfig}           [props.config]    - Optional config to customise layout, limits, and toolbar features.
 *
 * @example
 * // Minimal controlled usage
 * const [html, setHtml] = useState("");
 * <RichTextEditor value={html} setValue={setHtml} />
 *
 * @example
 * // Auto-grow height + character limit + extra toolbar buttons
 * const [html, setHtml] = useState("");
 * <RichTextEditor
 *   value={html}
 *   setValue={setHtml}
 *   config={{
 *     placeholder: "Start writing...",
 *     minHeight: 200,
 *     maxHeight: 500,
 *     maxLength: 2000,
 *     footerAlign: "left",
 *     features: {
 *       link: true,
 *       table: true,
 *       strikethrough: true,
 *       charCount: true,
 *       clearFormat: true,
 *     },
 *   }}
 * />
 */
export default function RichTextEditor({ value, onChange, setValue, config = {} }) {
    const cfg = {
        ...DEFAULT_CONFIG,
        ...config,
        features: { ...DEFAULT_CONFIG.features, ...(config.features || {}) },
    };
    const f = cfg.features;

    // ── setValue is a React setState setter (or any function) that gets called
    //    with the latest HTML on every change — works exactly like:
    //    const [richtext, setRichtext] = useState(""); → pass setRichtext as setValue
    //    This lets the parent keep a live copy of the content in their own state.

    const editorRef = useRef(null);
    const containerRef = useRef(null);
    const savedRangeRef = useRef(null);
    const hasFocusRef = useRef(false);
    const initDoneRef = useRef(false);
    const isResizingRef = useRef(false);

    const [modal, setModal] = useState(null);
    const [linkEditData, setLinkEditData] = useState(null);
    const [activeFormats, setActiveFormats] = useState({});
    const [wordCount, setWordCount] = useState(0);
    const [charCount, setCharCount] = useState(0);
    const [imageCount, setImageCount] = useState(0);
    const [selectedImg, setSelectedImg] = useState(null);
    const [imgRect, setImgRect] = useState(null);
    const [linkPopup, setLinkPopup] = useState(null);
    const [isCodeView, setIsCodeView] = useState(false);
    const [codeSource, setCodeSource] = useState("");
    const [errorMsg, setErrorMsg] = useState(null);
    const errorTimerRef = useRef(null);

    // Show a timed error message in the footer
    const showError = useCallback((msg, durationMs = 3500) => {
        setErrorMsg(msg);
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setErrorMsg(null), durationMs);
    }, []);

    useEffect(() => () => clearTimeout(errorTimerRef.current), []);

    // ── Value sync (handles DB async data, won't clobber user input) ───────────
    useEffect(() => {
        if (!editorRef.current) return;

        // First mount: set from defaultValue or value prop
        if (!initDoneRef.current) {
            const initial = cfg.defaultValue || value || "";
            editorRef.current.innerHTML = initial;
            refreshCounts(editorRef.current);
            initDoneRef.current = true;
            return;
        }

        // Subsequent external updates (e.g. DB fetch arrives):
        // only apply when editor is not focused to avoid clobbering user input
        if (hasFocusRef.current) return;
        if (value === undefined || value === null) return;

        if (editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
            refreshCounts(editorRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    // Store raw viewport coords — handles rendered as position:fixed via portal,
    // so getBoundingClientRect() maps directly with no relative-offset math needed.
    const updateImgRect = useCallback(() => {
        if (!selectedImg) { setImgRect(null); return; }
        const r = selectedImg.getBoundingClientRect();
        setImgRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    }, [selectedImg]);

    useEffect(() => {
        if (!selectedImg) { setImgRect(null); return; }
        updateImgRect();

        const deselect = () => {
            // Don't deselect while actively resizing
            if (isResizingRef.current) return;
            selectedImg.classList.remove("jhrte-img-selected-v1");
            setSelectedImg(null);
        };

        // Deselect on any scroll — both the editor's own scroll container and the page
        const el = editorRef.current;
        el?.addEventListener("scroll", deselect);
        window.addEventListener("scroll", deselect, true);
        return () => {
            el?.removeEventListener("scroll", deselect);
            window.removeEventListener("scroll", deselect, true);
        };
    }, [selectedImg, updateImgRect]);

    // ── Click-outside: deselect image & close link popup ──────────────────────
    useEffect(() => {
        const onDoc = (e) => {
            const onHandle = e.target.closest(".jhrte-img-corner-v1") || e.target.closest(".jhrte-img-selection-v1");
            if (selectedImg && !onHandle && !editorRef.current?.contains(e.target)) {
                selectedImg.classList.remove("jhrte-img-selected-v1");
                setSelectedImg(null);
            }
            if (
                linkPopup &&
                !e.target.closest(".jhrte-link-popup-v1") &&
                !editorRef.current?.contains(e.target)
            ) {
                setLinkPopup(null);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [selectedImg, linkPopup]);

    // ── Helpers ────────────────────────────────────────────────────────────────
    const refreshCounts = (el) => {
        const text = el.innerText.trim();
        setWordCount(text ? text.split(/\s+/).length : 0);
        setCharCount(text.length);
        setImageCount(el.querySelectorAll("img").length);
    };

    const updateActiveFormats = useCallback(() => {
        // Detect current block tag for heading select
        let currentBlock = "P";
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            let node = sel.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
            while (node && node !== editorRef.current) {
                const tag = node.nodeName;
                if (/^(P|H[1-6]|PRE|BLOCKQUOTE)$/.test(tag)) { currentBlock = tag; break; }
                node = node.parentNode;
            }
        }
        setActiveFormats({
            bold: document.queryCommandState("bold"),
            italic: document.queryCommandState("italic"),
            underline: document.queryCommandState("underline"),
            strikethrough: document.queryCommandState("strikeThrough"),
            superscript: document.queryCommandState("superscript"),
            subscript: document.queryCommandState("subscript"),
            unorderedList: document.queryCommandState("insertUnorderedList"),
            orderedList: document.queryCommandState("insertOrderedList"),
            justifyLeft: document.queryCommandState("justifyLeft"),
            justifyCenter: document.queryCommandState("justifyCenter"),
            justifyRight: document.queryCommandState("justifyRight"),
            justifyFull: document.queryCommandState("justifyFull"),
            currentBlock,
        });
    }, []);

    // selectionchange fires on every cursor move / click inside editor,
    // ensuring sup/sub and other toggle buttons always reflect current state
    useEffect(() => {
        document.addEventListener("selectionchange", updateActiveFormats);
        return () => document.removeEventListener("selectionchange", updateActiveFormats);
    }, [updateActiveFormats]);

    const saveSelection = useCallback(() => {
        const sel = window.getSelection();
        if (sel?.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }, []);

    const restoreSelection = useCallback(() => {
        editorRef.current?.focus();
        if (savedRangeRef.current) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRangeRef.current);
        }
    }, []);

    const [formValue, setFormValue] = useState(() => cfg.defaultValue || value || "");

    const emit = useCallback(() => {
        const html = editorRef.current?.innerHTML || "";
        onChange?.(html);
        setValue?.(html);          // React setState setter — keeps parent state in sync
        if (cfg.formId) setFormValue(html);
    }, [onChange, setValue, cfg.formId]);

    // ── value prop sync (DB async fetch arrives after mount) ─────────────────
    // setValue is a setter function — do NOT watch it as an effect dependency.

    const exec = useCallback((cmd, arg = null) => {
        try {
            editorRef.current?.focus();
            document.execCommand(cmd, false, arg);
            // For undo/redo: skip setValue (would corrupt the undo stack via
            // innerHTML reassignment in the value-sync effect). Just notify parent
            // via onChange (which is a simple callback, not a state setter).
            if (cmd === "undo" || cmd === "redo") {
                const html = editorRef.current?.innerHTML || "";
                onChange?.(html);
                if (cfg.formId) setFormValue(html);
                refreshCounts(editorRef.current);
            } else {
                emit();
            }
            updateActiveFormats();
        } catch (err) {
            showError(`Command failed: ${cmd}`);
        }
    }, [emit, onChange, cfg.formId, updateActiveFormats, showError]);

    // formatBlock needs focus + restored selection before execCommand
    const execFormatBlock = useCallback((tag) => {
        const editor = editorRef.current;
        if (!editor) return;

        // Snapshot the saved range NOW before the select's blur/focus cycle
        const rangeSnapshot = savedRangeRef.current ? savedRangeRef.current.cloneRange() : null;

        editor.focus();

        const restoreAndApply = () => {
            try {
                if (rangeSnapshot) {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(rangeSnapshot);
                }
                document.execCommand("formatBlock", false, tag);

                // Strip inline styles that would override heading CSS
                // (font-size, color — so h3 gold color, h1 large size etc all work)
                const sel = window.getSelection();
                if (sel?.rangeCount) {
                    const range = sel.getRangeAt(0);
                    const blocks = Array.from(editor.querySelectorAll("p, h1, h2, h3, h4, h5, h6, pre, blockquote"));
                    blocks.forEach(block => {
                        if (!range.intersectsNode || range.intersectsNode(block)) {
                            if (block.style) {
                                block.style.removeProperty("font-size");
                                block.style.removeProperty("color");
                            }
                            block.querySelectorAll("[style]").forEach(el => {
                                el.style.removeProperty("font-size");
                                el.style.removeProperty("color");
                                if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
                            });
                        }
                    });
                }

                emit();
                updateActiveFormats();
            } catch (err) {
                showError(`Could not apply block format: ${tag}`);
            }
        };

        requestAnimationFrame(() => requestAnimationFrame(restoreAndApply));
    }, [emit, updateActiveFormats, showError]);

    // Find nearest <sup>/<sub> ancestor of the current cursor/selection
    const findSupSubWrapper = useCallback((tag) => {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return null;
        let node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        while (node && node !== editorRef.current) {
            if (node.nodeName === tag.toUpperCase()) return node;
            node = node.parentNode;
        }
        return null;
    }, []);

    const execSupSub = useCallback((cmd, tag) => {
        editorRef.current?.focus();
        const sel = window.getSelection();
        const hasSelection = sel && sel.toString().length > 0;
        const wrapper = findSupSubWrapper(tag);

        if (wrapper && !hasSelection) {
            // Cursor is INSIDE sup/sub with nothing selected:
            // — clicking button exits the wrapper (cursor moves after it)
            // Insert a zero-width space AFTER the wrapper so browser doesn't re-inherit formatting
            const zws = document.createTextNode('\u200B');
            wrapper.after(zws);
            const range = document.createRange();
            range.setStart(zws, 1);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            emit();
            updateActiveFormats();
            return;
        }

        if (wrapper && hasSelection) {
            // Text selected AND it's inside sup/sub — remove formatting
            document.execCommand(cmd, false, null);
            emit();
            updateActiveFormats();
            return;
        }

        // Not in sup/sub: apply it, then auto-exit so next typing is normal
        document.execCommand(cmd, false, null);

        // Find the newly created wrapper and step cursor out of it
        const newWrapper = findSupSubWrapper(tag);
        if (newWrapper) {
            const zws = document.createTextNode('\u200B');
            newWrapper.after(zws);
            const range = document.createRange();
            range.setStart(zws, 1);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }

        emit();
        updateActiveFormats();
    }, [findSupSubWrapper, emit, updateActiveFormats]);

    const insertHTML = useCallback((html) => {
        restoreSelection();
        document.execCommand("insertHTML", false, html);
        emit();
    }, [emit, restoreSelection]);

    // ── Code View toggle ───────────────────────────────────────────────────────
    const toggleCodeView = useCallback(() => {
        if (!isCodeView) {
            const html = editorRef.current?.innerHTML || "";
            setCodeSource(html);
            setIsCodeView(true);
            // Deselect image / close popup when entering code view
            if (selectedImg) { selectedImg.classList.remove("jhrte-img-selected-v1"); setSelectedImg(null); }
            setLinkPopup(null);
        } else {
            if (editorRef.current) {
                editorRef.current.innerHTML = codeSource;
                refreshCounts(editorRef.current);
                onChange?.(codeSource);
            }
            setIsCodeView(false);
        }
    }, [isCodeView, codeSource, onChange, selectedImg]);

    // ── Insert actions ─────────────────────────────────────────────────────────
    const handleInsertTable = useCallback((rows, cols) => {
        let t = `<table border="1" style="width:100%;border-collapse:collapse;margin:1rem 0;"><tbody>`;
        for (let i = 0; i < rows; i++) {
            t += "<tr>";
            for (let j = 0; j < cols; j++)
                t += `<td style="padding:8px;border:1px solid var(--jhrte-table-border-v1,#333);min-width:60px;">&nbsp;</td>`;
            t += "</tr>";
        }
        t += "</tbody></table><p><br></p>";
        insertHTML(t);
    }, [insertHTML]);

    const handleInsertImage = useCallback((src, width) => {
        insertHTML(`<img src="${src}" style="width:${width}px;max-width:100%;" />`);
    }, [insertHTML]);

    const handleInsertLink = useCallback((url, text) => {
        restoreSelection();
        const sel = window.getSelection();
        if (sel?.toString()) {
            exec("createLink", url);
        } else {
            insertHTML(`<a href="${url}" target="_blank" rel="noopener noreferrer">${text?.trim() || url}</a>`);
        }
    }, [restoreSelection, exec, insertHTML]);

    const handleUpdateLink = useCallback((url, text) => {
        if (!linkEditData?.el) return;
        linkEditData.el.href = url;
        if (text?.trim()) linkEditData.el.textContent = text.trim();
        emit();
        setLinkEditData(null);
        setModal(null);
    }, [linkEditData, emit]);

    // ── Paste handler — always strips bg-color + text-color; blocks paste if maxLength exceeded ──
    const onPaste = useCallback((e) => {
        e.preventDefault();
        const html = e.clipboardData.getData("text/html");
        const text = e.clipboardData.getData("text/plain");

        // Build clean content
        let clean;
        if (html) {
            const tmp = document.createElement("div");
            tmp.innerHTML = html;

            tmp.querySelectorAll("*").forEach((el) => {
                if (!el.style) return;
                // Strip background & text color only if pasteClearColor is true (default)
                if (cfg.pasteClearColor !== false) {
                    el.style.removeProperty("background-color");
                    el.style.removeProperty("background");
                    el.style.removeProperty("color");
                }
                // Strip font if configured
                if (cfg.pasteClearFont) {
                    el.style.removeProperty("font-family");
                    el.style.removeProperty("font-size");
                }
                if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
            });

            // Remove legacy bgcolor/background attributes (HTML email style)
            if (cfg.pasteClearColor !== false) {
                tmp.querySelectorAll("[bgcolor]").forEach(el => el.removeAttribute("bgcolor"));
                tmp.querySelectorAll("[background]").forEach(el => el.removeAttribute("background"));
                // Remove font color attributes
                tmp.querySelectorAll("[color]").forEach(el => el.removeAttribute("color"));
            }

            clean = tmp.innerHTML;
        } else {
            clean = text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");
        }

        // maxLength check: account for selected text being replaced (Ctrl+A + paste case)
        if (cfg.maxLength != null && editorRef.current) {
            const sel = window.getSelection();
            const selectedLen = sel?.toString().length || 0;
            const currentLen = editorRef.current.innerText.replace(/\n/g, "").length;
            const pasteLen = (e.clipboardData.getData("text/plain") || "").length;
            // Net change = pasteLen - selectedLen (selected text gets deleted, new pasted)
            if (currentLen - selectedLen + pasteLen > cfg.maxLength) {
                showError(`Cannot paste: would exceed the ${cfg.maxLength}-character limit.`);
                return;
            }
        }

        // insertHTML automatically replaces the current selection (Ctrl+A selected text)
        document.execCommand("insertHTML", false, clean);
        emit();
        if (editorRef.current) refreshCounts(editorRef.current);
    }, [cfg.pasteClearFont, cfg.pasteClearColor, cfg.maxLength, emit, showError]);

    // ── Editor events ──────────────────────────────────────────────────────────
    const onInput = (e) => {
        try {
            if (cfg.maxLength != null && editorRef.current) {
                const text = editorRef.current.innerText.replace(/\n/g, "");
                if (text.length > cfg.maxLength) {
                    document.execCommand("undo", false, null);
                    showError(`Maximum ${cfg.maxLength} characters reached.`);
                    return;
                }
            }
            emit();
            updateActiveFormats();
            refreshCounts(e.currentTarget);
        } catch (err) {
            showError("An error occurred while editing.");
        }
    };

    const onEditorClick = (e) => {
        const target = e.target;

        if (target.tagName === "IMG" && editorRef.current?.contains(target)) {
            if (selectedImg && selectedImg !== target) selectedImg.classList.remove("jhrte-img-selected-v1");
            setSelectedImg(target);
            target.classList.add("jhrte-img-selected-v1");
            setLinkPopup(null);
            updateActiveFormats();
            return;
        }

        const linkEl = target.closest("a");
        if (linkEl && editorRef.current?.contains(linkEl)) {
            e.preventDefault();
            const r = linkEl.getBoundingClientRect();
            setLinkPopup({ el: linkEl, x: r.left, y: r.bottom + 6 });
            if (selectedImg) { selectedImg.classList.remove("jhrte-img-selected-v1"); setSelectedImg(null); }
            updateActiveFormats();
            return;
        }

        if (selectedImg) { selectedImg.classList.remove("jhrte-img-selected-v1"); setSelectedImg(null); }
        if (linkPopup && !target.closest(".jhrte-link-popup-v1")) setLinkPopup(null);
        updateActiveFormats();
    };

    // ── Corner resize ──────────────────────────────────────────────────────────
    const onCornerMouseDown = useCallback((e, corner) => {
        if (!selectedImg) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const initR = selectedImg.getBoundingClientRect();
        const startW = initR.width;
        const startH = initR.height;
        const ratio = startH / startW;

        isResizingRef.current = true;

        const onMove = (me) => {
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;

            let delta;
            if (corner === "se") delta = (Math.abs(dx) >= Math.abs(dy)) ? dx : dy / ratio;
            if (corner === "sw") delta = (Math.abs(dx) >= Math.abs(dy)) ? -dx : dy / ratio;
            if (corner === "ne") delta = (Math.abs(dx) >= Math.abs(dy)) ? dx : -dy / ratio;
            if (corner === "nw") delta = (Math.abs(dx) >= Math.abs(dy)) ? -dx : -dy / ratio;

            const newW = Math.max(40, startW + delta);
            const newH = Math.round(newW * ratio);
            selectedImg.style.width = `${newW}px`;
            selectedImg.style.height = `${newH}px`;
            updateImgRect();
        };

        const onUp = () => {
            isResizingRef.current = false;
            emit();
            // Immediately clear selection after resize — prevents frozen handles
            selectedImg.classList.remove("jhrte-img-selected-v1");
            setSelectedImg(null);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [selectedImg, emit, updateImgRect]);

    // ── Image drag-to-move (via selection overlay) ─────────────────────────────
    const onSelectionMouseDown = useCallback((e) => {
        if (!selectedImg || !editorRef.current) return;
        // Don't hijack corner-handle events
        if (e.target.classList.contains("jhrte-img-corner-v1")) return;
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        let hasMoved = false;
        let phantom = null;

        const imgW = selectedImg.getBoundingClientRect().width;
        const imgH = selectedImg.getBoundingClientRect().height;

        const onMove = (me) => {
            if (!hasMoved && (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5)) {
                hasMoved = true;
                phantom = selectedImg.cloneNode(true);
                phantom.classList.remove("jhrte-img-selected-v1");
                phantom.style.cssText = `
                    position:fixed; pointer-events:none; z-index:9999;
                    opacity:0.55; border-radius:6px;
                    width:${imgW}px; height:${imgH}px;
                    box-shadow:0 8px 32px rgba(0,0,0,0.5);
                `;
                document.body.appendChild(phantom);
            }
            if (phantom) {
                phantom.style.left = `${me.clientX - imgW / 2}px`;
                phantom.style.top = `${me.clientY - imgH / 2}px`;
            }
        };

        const onUp = (ue) => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            phantom?.remove();
            phantom = null;

            if (!hasMoved || !selectedImg || !editorRef.current) return;

            // Temporarily hide image to get element behind cursor
            selectedImg.style.visibility = "hidden";

            const range = (() => {
                if (document.caretRangeFromPoint) {
                    return document.caretRangeFromPoint(ue.clientX, ue.clientY);
                }
                const pos = document.caretPositionFromPoint?.(ue.clientX, ue.clientY);
                if (!pos) return null;
                const r = document.createRange();
                r.setStart(pos.offsetNode, pos.offset);
                r.collapse(true);
                return r;
            })();

            selectedImg.style.visibility = "";

            if (range && editorRef.current.contains(range.commonAncestorContainer)) {
                const clone = selectedImg.cloneNode(true);
                clone.classList.remove("jhrte-img-selected-v1");
                selectedImg.remove();
                range.insertNode(clone);
                emit();
            }

            // Deselect after move
            selectedImg.classList.remove("jhrte-img-selected-v1");
            setSelectedImg(null);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [selectedImg, emit]);

    const openModal = (name) => { saveSelection(); setModal(name); };

    const HANDLE = 10; // half-size of corner handle

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── Modals ─────────────────────────────────────────────────────── */}
            {modal === "table" && <TableModal onInsert={handleInsertTable} onClose={() => setModal(null)} />}
            {modal === "image" && <ImageModal showUpload={f.imageUpload} onInsert={handleInsertImage} onClose={() => setModal(null)} />}
            {modal === "link" && <LinkModal mode="insert" onInsert={handleInsertLink} onClose={() => setModal(null)} />}
            {modal === "link-edit" && linkEditData && (
                <LinkModal
                    mode="edit"
                    initialUrl={linkEditData.url}
                    initialText={linkEditData.text}
                    onInsert={handleUpdateLink}
                    onClose={() => { setModal(null); setLinkEditData(null); }}
                />
            )}

            {/* ── Link popup ─────────────────────────────────────────────────── */}
            {linkPopup && (
                <Portal>
                    <div
                        className="jhrte-link-popup-v1"
                        style={{ left: linkPopup.x, top: linkPopup.y }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <a className="jhrte-link-popup-href-v1" href={linkPopup.el.href}
                            target="_blank" rel="noopener noreferrer">{linkPopup.el.href}</a>
                        <div className="jhrte-link-popup-sep-v1" />
                        <button className="jhrte-link-popup-btn-v1" onClick={() => {
                            setLinkEditData({ el: linkPopup.el, url: linkPopup.el.href, text: linkPopup.el.textContent });
                            setLinkPopup(null);
                            setModal("link-edit");
                        }}>Edit</button>
                        <button className="jhrte-link-popup-btn-v1" onClick={() => {
                            if (linkPopup.el.parentNode) {
                                linkPopup.el.replaceWith(document.createTextNode(linkPopup.el.textContent));
                                emit();
                            }
                            setLinkPopup(null);
                        }}>Remove</button>
                    </div>
                </Portal>
            )}

            {/* ── Hidden input for form association (formId prop) ──────────── */}
            {cfg.formId && (
                <input
                    type="hidden"
                    form={cfg.formId}
                    name={cfg.name}
                    value={formValue}
                    readOnly
                />
            )}

            {/* ── Editor wrapper ─────────────────────────────────────────────── */}
            <div className={`jhrte-wrapper-v1${isCodeView ? " jhrte-code-view-mode-v1" : ""}`} style={{ width: cfg.width }}>

                {/* ── Toolbar ─────────────────────────────────────────────────── */}
                <div className="jhrte-toolbar-v1">

                    {(f.undo || f.redo) && (
                        <>
                            {f.undo && (
                                <ToolBtn title="Undo (Ctrl+Z)" disabled={isCodeView} onClick={() => exec("undo")}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 5.5C2 5.5 3.5 2 7 2C10.3137 2 13 4.68629 13 8C13 11.3137 10.3137 14 7 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M1 3L2.5 5.5L5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </ToolBtn>
                            )}
                            {f.redo && (
                                <ToolBtn title="Redo (Ctrl+Y)" disabled={isCodeView} onClick={() => exec("redo")}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5.5C12 5.5 10.5 2 7 2C3.68629 2 1 4.68629 1 8C1 11.3137 3.68629 14 7 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M13 3L11.5 5.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </ToolBtn>
                            )}
                            <Divider />
                        </>
                    )}

                    {f.headings && (
                        <>
                            <select
                                title="Block type"
                                disabled={isCodeView}
                                value={activeFormats.currentBlock || "P"}
                                className={`jhrte-select-v1 jhrte-select-heading-v1${isCodeView ? " jhrte-select-disabled-v1" : ""}`}
                                onMouseDown={() => saveSelection()}
                                onChange={(e) => execFormatBlock(e.target.value)}
                            >
                                <option value="P">Paragraph</option>
                                <option value="H1">Heading 1</option>
                                <option value="H2">Heading 2</option>
                                <option value="H3">Heading 3</option>
                                <option value="H4">Heading 4</option>
                                <option value="H5">Heading 5</option>
                                <option value="H6">Heading 6</option>
                                <option value="PRE">Preformat</option>
                            </select>
                            <Divider />
                        </>
                    )}

                    {f.fontFamily && (
                        <ToolSelect title="Font family" disabled={isCodeView} className="jhrte-select-font-v1" onChange={(v) => exec("fontName", v)}>
                            <option value="">Font</option>
                            <option value="sans-serif">Sans</option>
                            <option value="serif">Serif</option>
                            <option value="monospace">Mono</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Oxanium">Oxanium</option>
                            <option value="Impact">Impact</option>
                        </ToolSelect>
                    )}

                    {f.bold && (
                        <ToolBtn title="Bold (Ctrl+B)" disabled={isCodeView} active={activeFormats.bold} onClick={() => exec("bold")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 2H7.5C9.15685 2 10.5 3.34315 10.5 5C10.5 6.65685 9.15685 8 7.5 8H3.5V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M3.5 8H8C9.65685 8 11 9.34315 11 11C11 12.6569 9.65685 14 8 14H3.5V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.italic && (
                        <ToolBtn title="Italic (Ctrl+I)" disabled={isCodeView} active={activeFormats.italic} onClick={() => exec("italic")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="8" y1="1.5" x2="6" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="5" y1="1.5" x2="11" y2="1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="3" y1="12.5" x2="9" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.underline && (
                        <ToolBtn title="Underline (Ctrl+U)" disabled={isCodeView} active={activeFormats.underline} onClick={() => exec("underline")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2V7C3 9.20914 4.79086 11 7 11C9.20914 11 11 9.20914 11 7V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="1.5" y1="13.25" x2="12.5" y2="13.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.strikethrough && (
                        <ToolBtn title="Strikethrough" disabled={isCodeView} active={activeFormats.strikethrough} onClick={() => exec("strikeThrough")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5C3 3.11929 4.34315 2 6 2H8C9.65685 2 11 3.11929 11 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M5 12H9C10.1046 12 11 11.1046 11 10C11 8.89543 10.1046 8 9 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.superscript && (
                        <ToolBtn title="Superscript" disabled={isCodeView} active={activeFormats.superscript} onClick={() => execSupSub("superscript", "sup")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4L7 10M7 4L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M9.5 1H12.5V4H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><line x1="9.5" y1="4" x2="12.5" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.subscript && (
                        <ToolBtn title="Subscript" disabled={isCodeView} active={activeFormats.subscript} onClick={() => execSupSub("subscript", "sub")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4L7 10M7 4L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M9.5 10H12.5V13H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><line x1="9.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                        </ToolBtn>
                    )}

                    {(f.textColor || f.highlight) && (
                        <>
                            <Divider />
                            {f.textColor && (
                                <label className={`jhrte-color-label-v1${isCodeView ? " jhrte-color-label-disabled-v1" : ""}`} title="Text color">
                                    <span className="jhrte-color-label-text-v1">A</span>
                                    <input type="color" defaultValue="#ffffff" className="jhrte-color-input-v1"
                                        disabled={isCodeView}
                                        onChange={(e) => exec("foreColor", e.target.value)} />
                                </label>
                            )}
                            {f.highlight && (
                                <label className={`jhrte-color-label-v1${isCodeView ? " jhrte-color-label-disabled-v1" : ""}`} title="Highlight color">
                                    <span className="jhrte-color-label-text-v1">H</span>
                                    <input type="color" defaultValue="#ffff00" className="jhrte-color-input-v1"
                                        disabled={isCodeView}
                                        onChange={(e) => exec("hiliteColor", e.target.value)} />
                                </label>
                            )}
                        </>
                    )}

                    <Divider />

                    {(f.unorderedList || f.orderedList || f.indent) && (
                        <>
                            {f.unorderedList && (
                                <ToolBtn title="Bullet list" disabled={isCodeView} active={activeFormats.unorderedList} onClick={() => exec("insertUnorderedList")}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="3" r="1.2" fill="currentColor" /><rect x="4.5" y="2.25" width="8" height="1.5" rx="0.75" fill="currentColor" /><circle cx="2" cy="7" r="1.2" fill="currentColor" /><rect x="4.5" y="6.25" width="8" height="1.5" rx="0.75" fill="currentColor" /><circle cx="2" cy="11" r="1.2" fill="currentColor" /><rect x="4.5" y="10.25" width="8" height="1.5" rx="0.75" fill="currentColor" /></svg>
                                </ToolBtn>
                            )}
                            {f.orderedList && (
                                <ToolBtn title="Numbered list" disabled={isCodeView} active={activeFormats.orderedList} onClick={() => exec("insertOrderedList")}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="0.5" y="4.5" fontSize="4.5" fill="currentColor" fontFamily="monospace" fontWeight="bold">1.</text><rect x="4.5" y="2.25" width="8" height="1.5" rx="0.75" fill="currentColor" /><text x="0.5" y="8.5" fontSize="4.5" fill="currentColor" fontFamily="monospace" fontWeight="bold">2.</text><rect x="4.5" y="6.25" width="8" height="1.5" rx="0.75" fill="currentColor" /><text x="0.5" y="12.5" fontSize="4.5" fill="currentColor" fontFamily="monospace" fontWeight="bold">3.</text><rect x="4.5" y="10.25" width="8" height="1.5" rx="0.75" fill="currentColor" /></svg>
                                </ToolBtn>
                            )}
                            {f.indent && <>
                                <ToolBtn title="Indent" disabled={isCodeView} onClick={() => exec("indent")}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="12" height="1.4" rx="0.7" fill="currentColor" /><rect x="5" y="5.3" width="8" height="1.4" rx="0.7" fill="currentColor" /><rect x="5" y="8.6" width="8" height="1.4" rx="0.7" fill="currentColor" /><rect x="1" y="11.9" width="12" height="1.4" rx="0.7" fill="currentColor" /><path d="M1.5 6L3.5 7.25L1.5 8.5V6Z" fill="currentColor" /></svg>
                                </ToolBtn>
                                <ToolBtn title="Outdent" disabled={isCodeView} onClick={() => exec("outdent")}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="12" height="1.4" rx="0.7" fill="currentColor" /><rect x="5" y="5.3" width="8" height="1.4" rx="0.7" fill="currentColor" /><rect x="5" y="8.6" width="8" height="1.4" rx="0.7" fill="currentColor" /><rect x="1" y="11.9" width="12" height="1.4" rx="0.7" fill="currentColor" /><path d="M4 6L2 7.25L4 8.5V6Z" fill="currentColor" /></svg>
                                </ToolBtn>
                            </>}
                            <Divider />
                        </>
                    )}

                    {f.align && (
                        <>
                            <ToolBtn title="Align left" disabled={isCodeView} active={activeFormats.justifyLeft} onClick={() => exec("justifyLeft")}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="5.5" width="8" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="12.5" width="6" height="1.5" rx="0.75" fill="currentColor" /></svg>
                            </ToolBtn>
                            <ToolBtn title="Align center" disabled={isCodeView} active={activeFormats.justifyCenter} onClick={() => exec("justifyCenter")}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="3" y="5.5" width="8" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="4" y="12.5" width="6" height="1.5" rx="0.75" fill="currentColor" /></svg>
                            </ToolBtn>
                            <ToolBtn title="Align right" disabled={isCodeView} active={activeFormats.justifyRight} onClick={() => exec("justifyRight")}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="5" y="5.5" width="8" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="7" y="12.5" width="6" height="1.5" rx="0.75" fill="currentColor" /></svg>
                            </ToolBtn>
                            <ToolBtn title="Justify" disabled={isCodeView} active={activeFormats.justifyFull} onClick={() => exec("justifyFull")}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="5.5" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="9" width="12" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="12.5" width="12" height="1.5" rx="0.75" fill="currentColor" /></svg>
                            </ToolBtn>
                            <Divider />
                        </>
                    )}

                    {f.link && (
                        <ToolBtn title="Insert link" disabled={isCodeView} onClick={() => openModal("link")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 8.5C6.16304 9.16304 7.22876 9.33 8.06066 8.76777L10.4749 6.35355C11.2559 5.57254 11.2559 4.30621 10.4749 3.52513C9.6939 2.74408 8.42757 2.74408 7.64645 3.52513L6.58579 4.58579" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M8.5 5.5C7.83696 4.83696 6.77124 4.67 5.93934 5.23223L3.52513 7.64645C2.74408 8.42746 2.74408 9.69379 3.52513 10.4749C4.3062 11.2559 5.57254 11.2559 6.35355 10.4749L7.41421 9.41421" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.table && (
                        <ToolBtn title="Insert table" disabled={isCodeView} onClick={() => openModal("table")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.2" /><line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.2" /><line x1="5" y1="5" x2="5" y2="13" stroke="currentColor" strokeWidth="1.2" /><line x1="9" y1="5" x2="9" y2="13" stroke="currentColor" strokeWidth="1.2" /></svg>
                        </ToolBtn>
                    )}
                    {f.image && (
                        <ToolBtn title="Insert image" disabled={isCodeView} onClick={() => openModal("image")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><circle cx="4.5" cy="5.5" r="1.2" stroke="currentColor" strokeWidth="1.1" /><path d="M1 10L4.5 6.5L7 9L9.5 7L13 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.codeBlock && (
                        <ToolBtn title="Code block" disabled={isCodeView} onClick={() => insertHTML(`<pre><code>// code here</code></pre><p><br></p>`)}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 4L1.5 7L4.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.5 4L12.5 7L9.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><line x1="8" y1="2.5" x2="6" y2="11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.blockquote && (
                        <ToolBtn title="Blockquote" disabled={isCodeView} onClick={() => exec("formatBlock", "BLOCKQUOTE")}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="2" height="10" rx="1" fill="currentColor" /><path d="M5 4H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M5 7H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M5 10H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                        </ToolBtn>
                    )}
                    {f.hr && (
                        <ToolBtn title="Horizontal rule" disabled={isCodeView} onClick={() => insertHTML(`<hr /><p><br></p>`)}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 1.5" /><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 1.5" /></svg>
                        </ToolBtn>
                    )}

                    {f.clearFormat && (
                        <>
                            <Divider />
                            <ToolBtn title="Clear formatting" disabled={isCodeView} onClick={() => exec("removeFormat")}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2H11L8.5 7H10L7.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><line x1="2" y1="12.5" x2="6.5" y2="12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><line x1="11" y1="2.5" x2="13" y2="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><line x1="13" y1="2.5" x2="11" y2="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                            </ToolBtn>
                        </>
                    )}

                    {f.bgHighlight && (
                        <>
                            <Divider />
                            <BgHighlightBtn disabled={isCodeView} exec={exec} saveSelection={saveSelection} restoreSelection={restoreSelection} />
                        </>
                    )}

                    {f.codeView && (
                        <>
                            <Divider />
                            <ToolBtn
                                title={isCodeView ? "Back to visual editor" : "View / edit HTML source"}
                                active={isCodeView}
                                data-id="code-view-btn"
                                onClick={toggleCodeView}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 3C1 1.89543 1.89543 1 3 1H11C12.1046 1 13 1.89543 13 3V11C13 12.1046 12.1046 13 11 13H3C1.89543 13 1 12.1046 1 11V3Z" stroke="currentColor" strokeWidth="1.2" /><path d="M5 5L3 7L5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 5L11 7L9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </ToolBtn>
                        </>
                    )}
                </div>

                {/* ── Content area ──────────────────────────────────────────────── */}
                <div style={{ flex: 1, overflow: "hidden" }}>

                    {/* Visual editor */}
                    <div
                        ref={editorRef}
                        className="jhrte-content-v1"
                        contentEditable={!isCodeView}
                        suppressContentEditableWarning
                        style={{
                            ...contentHeightStyle(cfg),
                            display: isCodeView ? "none" : undefined,
                        }}
                        onFocus={() => { hasFocusRef.current = true; }}
                        onBlur={() => { hasFocusRef.current = false; }}
                        onInput={onInput}
                        onKeyUp={(e) => { updateActiveFormats(); saveSelection(); }}
                        onMouseUp={(e) => { updateActiveFormats(); saveSelection(); }}
                        onClick={onEditorClick}
                        onPaste={onPaste}
                        data-placeholder={cfg.placeholder}
                    />

                    {/* Code view textarea */}
                    {isCodeView && (
                        <textarea
                            className="jhrte-code-textarea-v1"
                            style={contentHeightStyle(cfg)}
                            value={codeSource}
                            spellCheck={false}
                            onChange={(e) => {
                                setCodeSource(e.target.value);
                                onChange?.(e.target.value);
                                if (cfg.formId) setFormValue(e.target.value);
                            }}
                        />
                    )}
                </div>

                {/* ── Footer — always rendered when there's an error; stats are optional ── */}
                {(f.wordCount || f.charCount || f.imageCount || errorMsg) && (
                    <div className="jhrte-footer-v1" style={{ justifyContent: cfg.footerAlign === "left" ? "flex-start" : cfg.footerAlign === "center" ? "center" : "flex-end" }}>
                        {/* Error message — takes full width, shown above/before stats */}
                        {errorMsg && (
                            <span className="jhrte-footer-error-v1" role="alert">
                                ⚠ {errorMsg}
                            </span>
                        )}
                        {/* Stats badges — right side */}
                        {!errorMsg && (<>
                            {isCodeView
                                ? <span className="jhrte-footer-badge-v1 jhrte-footer-mode-v1">HTML source</span>
                                : (<>
                                    {f.wordCount && (
                                        <span className="jhrte-footer-badge-v1">
                                            {wordCount} word{wordCount !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                    {f.charCount && (
                                        <span className={`jhrte-footer-badge-v1${cfg.maxLength != null && charCount >= cfg.maxLength * 0.9 ? " jhrte-footer-limit-warn-v1" : ""}`}>
                                            {charCount}{cfg.maxLength != null ? `/${cfg.maxLength}` : ""} char{charCount !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                    {f.imageCount && (
                                        <span className="jhrte-footer-badge-v1">
                                            {imageCount} img{imageCount !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                </>)
                            }
                        </>)}
                    </div>
                )}
            </div>

            {/* ── Image handles — rendered in a Portal as position:fixed so viewport coords
                 from getBoundingClientRect() map directly with zero offset math ──────── */}
            {!isCodeView && imgRect && (
                <Portal>
                    {/* Selection border + drag-move surface */}
                    <div
                        className="jhrte-img-selection-v1"
                        style={{
                            left: imgRect.left,
                            top: imgRect.top,
                            width: imgRect.width,
                            height: imgRect.height,
                        }}
                        onMouseDown={onSelectionMouseDown}
                    />
                    {/* Corner resize handles */}
                    {["nw", "ne", "sw", "se"].map((corner) => {
                        const isLeft = corner.includes("w");
                        const isTop = corner.includes("n");
                        return (
                            <div
                                key={corner}
                                className="jhrte-img-corner-v1"
                                style={{
                                    left: isLeft ? imgRect.left - HANDLE : imgRect.left + imgRect.width - HANDLE,
                                    top: isTop ? imgRect.top - HANDLE : imgRect.top + imgRect.height - HANDLE,
                                    cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
                                }}
                                onMouseDown={(e) => onCornerMouseDown(e, corner)}
                            />
                        );
                    })}
                </Portal>
            )}
        </>
    );
}