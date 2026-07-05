/**
 * @fileoverview useFormState — generic, production-grade form state hook.
 *
 * One small API that handles:
 *   • form values of any shape (scalars, objects, arrays, deeply nested)
 *   • dirty tracking — global (`isDirty`) and per-field (`isDirtyAt`, `dirtyFields`)
 *   • file uploads & media removal
 *   • validation (manual rules and/or Zod schema), validateOnChange safe
 *   • touched / blurred / error state
 *   • async submission flow
 *   • list sorting, reordering, and sort-order normalization
 *   • server data re-sync when loader data changes
 *
 * Object operations and list operations have **full parity at any depth**.
 * Every setter accepts a dot-path, so you can update `form.name` and
 * `form.sections[0].blocks[2].content` with the same API.
 *
 * @module useFormState
 *
 * @example <caption>Minimal</caption>
 * function buildFormShape(data) {
 *     return { title: str(data?.title), archived: bool(data?.archived) };
 * }
 *
 * const { form, isDirty, set, reset } = useFormState(serverData, buildFormShape);
 *
 * <TextField value={form.title} setValue={v => set("title", v)} />
 * <Button disabled={!isDirty} onClick={reset}>Discard</Button>
 *
 * @example <caption>Deeply nested — full feature usage</caption>
 * const fs = useFormState(page, buildFormShape, {
 *     validate: (form) => {
 *         const errors = {};
 *         if (!form.title) errors.title = "Required";
 *         form.sections.forEach((s, i) => {
 *             if (!s.heading) errors[`sections.${i}.heading`] = "Required";
 *         });
 *         return errors;
 *     },
 *     onSubmit: async (form, { pendingFiles, removedMediaKeys }) => {
 *         const data = new FormData();
 *         data.append("payload", JSON.stringify(form));
 *         data.append("removedMedia", JSON.stringify(removedMediaKeys));
 *         for (const [slot, list] of Object.entries(pendingFiles)) {
 *             if (list?.[0]) data.append(slot, list[0]);
 *         }
 *         fetcher.submit(data, { method: "POST", encType: "multipart/form-data" });
 *     },
 * });
 *
 * // Update any scalar — any depth
 * fs.set("title", "Hello")
 * fs.set("seo.og.image.alt", "Cover image")
 *
 * // Batch-update multiple fields in one render
 * fs.setMany([["title", "Hello"], ["seo.og.image.alt", "Cover"]])
 *
 * // Add/remove/move items in any list — any depth
 * fs.addItem("sections", { heading: "", blocks: [] })
 * fs.addItem("sections.0.blocks", { type: "text", content: "" })
 * fs.removeItem("sections.0.blocks", 2)
 * fs.moveItem("sections", 2, 0)
 * fs.swapItems("sections.0.blocks", 0, 1)
 * fs.duplicateItem("sections.0.blocks", 1)
 *
 * // Sorting & reordering
 * fs.sortList("faqItems", "sortOrder")              // sort by key ascending
 * fs.sortList("faqItems", "question", "desc")       // sort by key descending
 * fs.reorderList("faqItems", dragFrom, dragTo)      // drag-and-drop reorder
 * fs.normalizeSortOrder("faqItems", "sortOrder")    // re-assign 0,1,2… after reorder
 *
 * // Dynamic object keys
 * fs.setKey("socialLinks", "tiktok", "https://...")
 * fs.deleteKey("socialLinks", "twitter")
 *
 * // Files & media
 * <ImagePickerField
 *     value={fs.pendingFiles.cover ?? []}
 *     setValue={fs.fileSetterFor("cover")}
 *     previewUrl={fs.form.coverUrl}
 *     onPreviewRemove={() => fs.removeMedia("coverUrl")}
 * />
 *
 * // Per-field dirty check
 * const isTitleDirty = fs.isDirtyAt("title");
 * const isAddressDirty = fs.isDirtyAt("address");
 *
 * // Validation in JSX
 * <TextField
 *     value={fs.form.title}
 *     setValue={v => fs.set("title", v)}
 *     onBlur={() => fs.touchField("title")}
 *     error={fs.errorFor("title")}
 * />
 *
 * <Button disabled={!fs.isDirty || fs.isSubmitting} onClick={fs.submit}>
 *     {fs.isSubmitting ? "Saving…" : "Save"}
 * </Button>
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ═════════════════════════════════════════════════════════════
 * Normalize helpers
 *
 * Use inside `buildFormShape` so values have a stable, comparable
 * shape. Prevents null-vs-"" and undefined-vs-0 from tripping
 * the dirty check.
 * ═════════════════════════════════════════════════════════════ */

/**
 * Coerce null/undefined to `""`.
 * @param {string | null | undefined} v
 * @returns {string}
 */
export const str = (v) => v ?? "";

/**
 * Coerce null/undefined to `false`.
 * @param {boolean | null | undefined} v
 * @returns {boolean}
 */
export const bool = (v) => v ?? false;

/**
 * Coerce null/undefined to `""`, numbers to strings.
 * Use for `<input type="number">` bindings.
 * @param {number | string | null | undefined} v
 * @returns {string}
 */
export const num = (v) => (v == null ? "" : String(v));

/**
 * Return `v` if it's a non-empty array, else `fallback` (default `[]`).
 * @template T
 * @param {T[] | null | undefined} v
 * @param {T[]} [fallback=[]]
 * @returns {T[]}
 */
export const arr = (v, fallback = []) =>
    Array.isArray(v) && v.length > 0 ? v : fallback;

/**
 * Return `v` if it's a plain (non-array) object, else `fallback`.
 * Use in `buildFormShape` to safely unwrap optional nested objects.
 * @param {Object | null | undefined} v
 * @param {Object} fallback
 * @returns {Object}
 *
 * @example
 * address: obj(data?.address, { city: "", zip: "" })
 */
export const obj = (v, fallback) =>
    v != null && typeof v === "object" && !Array.isArray(v) ? v : fallback;

/* ═════════════════════════════════════════════════════════════
 * Internal utilities — deep clone, path manipulation, deep equality
 * ═════════════════════════════════════════════════════════════ */

/**
 * Deep clone any serializable value.
 * Uses native `structuredClone` when available (Node 17+, modern browsers),
 * falls back to JSON round-trip for older environments.
 * @private
 */
function deepClone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

/**
 * Structural deep equality. Handles plain objects, arrays, Dates,
 * NaN, key order, and treats null/undefined as equal.
 * @private
 */
function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a == null && b == null;
    if (typeof a !== typeof b) return false;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof File || b instanceof File) return a === b;
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
        return true;
    }
    if (typeof a === "object") {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        for (const k of aKeys) if (!deepEqual(a[k], b[k])) return false;
        return true;
    }
    if (typeof a === "number" && typeof b === "number") {
        return Number.isNaN(a) && Number.isNaN(b);
    }
    return false;
}

/**
 * Parse a dot-path string into segments. Numeric segments become numbers
 * so arrays index correctly.
 *   "address.geo.lat" → ["address", "geo", "lat"]
 *   "tags.0.name"     → ["tags", 0, "name"]
 *   ["a", 0, "b"]     → ["a", 0, "b"]   (already-parsed input passes through)
 * @private
 */
function parsePath(path) {
    if (Array.isArray(path)) return path;
    if (path == null || path === "") return [];
    return String(path).split(".").map(p => (/^\d+$/.test(p) ? Number(p) : p));
}

/**
 * Immutably get a value at a dot-path. Returns `undefined` if any
 * segment is missing.
 * @private
 */
function getAt(obj, path) {
    const segments = parsePath(path);
    let current = obj;
    for (const segment of segments) {
        if (current == null) return undefined;
        current = current[segment];
    }
    return current;
}

/**
 * Immutably set a value at a dot-path. Clones each container along
 * the way (so React sees new refs); branches not on the path keep
 * their original references.
 * @private
 */
function setAt(obj, path, value) {
    const segments = parsePath(path);
    if (segments.length === 0) return value;

    const root = Array.isArray(obj) ? [...obj] : { ...obj };
    let current = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        const nextKey = segments[i + 1];
        const child = current[key];
        const cloned =
            child == null
                ? (typeof nextKey === "number" ? [] : {})
                : Array.isArray(child) ? [...child] : { ...child };
        current[key] = cloned;
        current = cloned;
    }
    current[segments[segments.length - 1]] = value;
    return root;
}

/**
 * Immutably delete a key/index at a dot-path.
 *  - Object key → property removed.
 *  - Array index → element spliced out (array length shrinks).
 * @private
 */
function deleteAt(obj, path) {
    const segments = parsePath(path);
    if (segments.length === 0) return obj;

    const root = Array.isArray(obj) ? [...obj] : { ...obj };
    let current = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        const child = current[key];
        if (child == null) return root;
        const cloned = Array.isArray(child) ? [...child] : { ...child };
        current[key] = cloned;
        current = cloned;
    }
    const lastSegment = segments[segments.length - 1];
    if (Array.isArray(current)) current.splice(Number(lastSegment), 1);
    else delete current[lastSegment];
    return root;
}

/**
 * Immutably update an array at a dot-path with a transform function.
 * The transform receives a shallow copy of the array and may mutate it
 * (push, splice, reverse — whatever) before returning. Returns the new root.
 * @private
 */
function updateArrayAt(obj, path, transform) {
    const segments = parsePath(path);
    if (segments.length === 0) {
        if (!Array.isArray(obj)) throw new Error("useFormState: updateArrayAt — root is not an array");
        const next = [...obj];
        transform(next);
        return next;
    }
    const currentArray = getAt(obj, segments);
    if (!Array.isArray(currentArray)) {
        throw new Error(`useFormState: updateArrayAt — value at "${segments.join(".")}" is not an array`);
    }
    const nextArray = [...currentArray];
    transform(nextArray);
    return setAt(obj, segments, nextArray);
}

/**
 * Normalize a path input (string | array) into a stable string key
 * for use in `fieldErrors` / `touchedFields` maps.
 * @private
 */
function toPathKey(path) {
    return Array.isArray(path) ? path.join(".") : String(path);
}

/* ═════════════════════════════════════════════════════════════
 * JSDoc typedefs
 * ═════════════════════════════════════════════════════════════ */

/**
 * @typedef {string | Array<string|number>} Path
 *   A dot-path string (`"sections.0.blocks.2.content"`) or an array
 *   of segments (`["sections", 0, "blocks", 2, "content"]`).
 */

/**
 * @typedef {"asc" | "desc"} SortDirection
 *   Sort direction: `"asc"` (default) for ascending, `"desc"` for descending.
 */

/**
 * @typedef {Object} UseFormStateOptions
 *
 * @property {function(Object): Object} [validate]
 *   Sync validator. Receives the live `form`, returns
 *   `{ [path: string]: string }` of errors. Empty = valid.
 *
 *   @example
 *   validate: (form) => {
 *       const errors = {};
 *       if (!form.name) errors.name = "Required";
 *       if (!form.address.city) errors["address.city"] = "Required";
 *       return errors;
 *   }
 *
 * @property {{ safeParse: function }} [schema]
 *   A Zod (or compatible) schema. If present, runs before `validate`.
 *   Errors merge with `validate`'s; `validate` wins on conflicts.
 *
 *   @example
 *   schema: z.object({ name: z.string().min(1), email: z.string().email() })
 *
 * @property {boolean} [validateOnChange=false]
 *   Run validation on every value change. Default off — most apps
 *   prefer showing errors only after blur or submit.
 *
 * @property {function(Object, { pendingFiles: Object, removedMediaKeys: Object }): (void|Promise<void>)} [onSubmit]
 *   Called by `submit()` once validation passes. If it returns a promise,
 *   `isSubmitting` stays true until it resolves or rejects.
 *
 * @property {boolean} [syncOnServerDataChange=true]
 *   When `true` (default), if `serverData` reference changes the hook
 *   re-initialises form + snapshot automatically (like a fresh page load).
 *   Set to `false` if you manage re-sync yourself via `syncAfterSave`.
 */

/* ═════════════════════════════════════════════════════════════
 * The hook
 * ═════════════════════════════════════════════════════════════ */

/**
 * Generic form state hook.
 *
 * @param {Object} serverData
 *   Raw data (e.g. from a loader). May be `null`/`undefined`.
 *
 * @param {function(Object): Object} buildFormShape
 *   Pure function mapping server data → clean form shape.
 *   Should be defined module-level or wrapped in useCallback.
 *
 * @param {UseFormStateOptions} [options]
 */
export function useFormState(serverData, buildFormShape, options = {}) {
    const {
        validate,
        schema,
        validateOnChange = false,
        onSubmit,
        syncOnServerDataChange = true,
    } = options;

    // ── Stable refs so option callbacks never invalidate memoized hooks ──
    const buildFormShapeRef = useRef(buildFormShape);
    const validateRef = useRef(validate);
    const schemaRef = useRef(schema);
    const onSubmitRef = useRef(onSubmit);
    buildFormShapeRef.current = buildFormShape;
    validateRef.current = validate;
    schemaRef.current = schema;
    onSubmitRef.current = onSubmit;

    // ── Core state ────────────────────────────────────────────────────────
    const [form, setForm] = useState(() => buildFormShape(serverData));
    const [savedSnapshot, setSavedSnapshot] = useState(() => buildFormShape(serverData));
    const [pendingFiles, setPendingFiles] = useState({});   // { slotName: File[] }
    const [removedMediaKeys, setRemovedMediaKeys] = useState({}); // { urlField: true }
    const [fieldErrors, setFieldErrors] = useState({});
    const [touchedFields, setTouchedFields] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitAttemptCount, setSubmitAttemptCount] = useState(0);
    const [hasRunValidation, setHasRunValidation] = useState(false);

    // Latest form always readable without closure staleness
    const latestFormRef = useRef(form);
    latestFormRef.current = form;

    // ── Server data re-sync ───────────────────────────────────────────────
    const prevServerDataRef = useRef(serverData);
    useEffect(() => {
        if (!syncOnServerDataChange) return;
        if (serverData === prevServerDataRef.current) return;
        prevServerDataRef.current = serverData;
        const freshShape = buildFormShapeRef.current(serverData);
        setForm(freshShape);
        setSavedSnapshot(freshShape);
        setPendingFiles({});
        setRemovedMediaKeys({});
        setFieldErrors({});
        setTouchedFields({});
        setSubmitAttemptCount(0);
        setHasRunValidation(false);
    }, [serverData, syncOnServerDataChange]);

    /* ── Validation core ─────────────────────────────────────────────── */

    /**
     * Run schema + validate together. Pure — no state mutation.
     * @private
     */
    const runValidationPure = useCallback((formValue) => {
        let collectedErrors = {};
        const activeSchema = schemaRef.current;
        const validateFn = validateRef.current;

        if (activeSchema?.safeParse) {
            const result = activeSchema.safeParse(formValue);
            if (!result.success) {
                for (const issue of result.error.issues) {
                    const key = issue.path.join(".");
                    if (!collectedErrors[key]) collectedErrors[key] = issue.message;
                }
            }
        }
        if (typeof validateFn === "function") {
            const manualErrors = validateFn(formValue) || {};
            collectedErrors = { ...collectedErrors, ...manualErrors };
        }
        return collectedErrors;
    }, []);

    // ── validateOnChange: run in an effect so we never call setState
    //    inside another setState updater (React rule violation).
    useEffect(() => {
        if (!validateOnChange) return;
        const errors = runValidationPure(form);
        setFieldErrors(errors);
        setHasRunValidation(true);
    }, [form, validateOnChange, runValidationPure]);

    /**
     * Run validation right now and commit errors to state.
     * @returns {boolean} `true` when the form is valid.
     */
    const validateNow = useCallback(() => {
        const errors = runValidationPure(latestFormRef.current);
        setFieldErrors(errors);
        setHasRunValidation(true);
        return Object.keys(errors).length === 0;
    }, [runValidationPure]);

    /**
     * Internal: apply an updater function to `form`.
     * Kept separate so all setters share the same path.
     * @private
     */
    const applyFormUpdate = useCallback((updater) => {
        setForm(prev => typeof updater === "function" ? updater(prev) : updater);
    }, []);

    /* ── Derived state ──────────────────────────────────────────────── */

    /**
     * `true` if anything has changed since the last save/sync.
     * Also `true` when there are pending file uploads or removed media.
     */
    const isDirty = useMemo(() => {
        if (Object.values(pendingFiles).some(fileList => fileList?.length > 0)) return true;
        if (Object.values(removedMediaKeys).some(Boolean)) return true;
        return !deepEqual(form, savedSnapshot);
    }, [form, savedSnapshot, pendingFiles, removedMediaKeys]);

    /**
     * `true` only after at least one validation run and zero errors.
     * (Avoids the false-positive of `errors === {}` before any validation.)
     */
    const isValid = useMemo(
        () => hasRunValidation && Object.keys(fieldErrors).length === 0,
        [hasRunValidation, fieldErrors],
    );

    /**
     * Map of `{ "dot.path": true }` for every leaf path that differs
     * from the saved snapshot. Useful for section-level dirty counts.
     *
     * @example
     * const sectionDirtyCount = section.fields.filter(f => dirtyFields[f.key]).length;
     */
    const dirtyFields = useMemo(() => {
        const result = {};
        function walkDiff(currentValue, snapshotValue, prefix) {
            if (
                currentValue == null ||
                typeof currentValue !== "object" ||
                currentValue instanceof Date ||
                currentValue instanceof File
            ) {
                if (!deepEqual(currentValue, snapshotValue)) result[prefix] = true;
                return;
            }
            for (const key of Object.keys(currentValue)) {
                const childPath = prefix ? `${prefix}.${key}` : key;
                walkDiff(currentValue[key], snapshotValue?.[key], childPath);
            }
        }
        walkDiff(form, savedSnapshot, "");
        return result;
    }, [form, savedSnapshot]);

    /* ─────────────────────────────────────────────────────────
     * GENERAL VALUE OPERATIONS — work at any depth, on any kind
     * of value (scalar, object property, array element).
     * ───────────────────────────────────────────────────────── */

    /**
     * Set any value at any depth.
     * @param {Path} path
     * @param {*} value
     * @example
     * set("title", "Hello")
     * set("address.geo.lat", 22.84)
     * set("sections.0.blocks.2.content", "Updated")
     */
    const set = useCallback((path, value) => {
        applyFormUpdate(prev => setAt(prev, path, value));
    }, [applyFormUpdate]);

    /**
     * Batch-set multiple paths in a single render cycle.
     * @param {Array<[Path, *]>} pairs  Array of [path, value] tuples.
     * @example
     * setMany([
     *   ["title", "Hello"],
     *   ["seo.og.image.alt", "Cover"],
     *   ["sections.0.heading", "Intro"],
     * ])
     */
    const setMany = useCallback((pairs) => {
        applyFormUpdate(prev => {
            let next = prev;
            for (const [path, value] of pairs) {
                next = setAt(next, path, value);
            }
            return next;
        });
    }, [applyFormUpdate]);

    /**
     * Read any value at any depth from the **live** form.
     * Returns `undefined` when the path is missing.
     * @param {Path} path
     * @returns {*}
     */
    const get = useCallback((path) => getAt(latestFormRef.current, path), []);

    /**
     * Read any value at any depth from the **saved snapshot**.
     * Useful to build "revert this field" logic without exposing `savedSnapshot`.
     * @param {Path} [path]  Omit to get the entire snapshot.
     * @returns {*}
     */
    const getSnapshotValue = useCallback((path) => {
        // savedSnapshot lives in closure; read via ref for stability
        return path ? getAt(savedSnapshotRef.current, path) : savedSnapshotRef.current;
    }, []);

    /**
     * Delete a key or array index at any depth.
     *   - Object key → property removed.
     *   - Array index → element spliced out (length shrinks).
     * @param {Path} path
     * @example
     * removeField("socialLinks.twitter")
     * removeField("sections.0.blocks.2")
     */
    const removeField = useCallback((path) => {
        applyFormUpdate(prev => deleteAt(prev, path));
    }, [applyFormUpdate]);

    /**
     * Merge a partial object into the value at a path.
     * Default (no path) merges into root.
     * @param {Object} patch
     * @param {Path} [path]
     * @example
     * merge({ name: "X", email: "x@y.z" })
     * merge({ city: "Dhaka" }, "address")
     */
    const merge = useCallback((patch, path) => {
        applyFormUpdate(prev => {
            const segments = parsePath(path);
            if (segments.length === 0) return { ...prev, ...patch };
            const current = getAt(prev, segments) || {};
            return setAt(prev, segments, { ...current, ...patch });
        });
    }, [applyFormUpdate]);

    /* ─────────────────────────────────────────────────────────
     * OBJECT HELPERS — dynamic keys
     * ───────────────────────────────────────────────────────── */

    /**
     * Set (or add) a dynamic key on an object at any depth.
     * @param {Path} parentPath  Path to the object that holds the key.
     * @param {string} key
     * @param {*} value
     * @example
     * setObjectKey("socialLinks", "tiktok", "https://tiktok.com/@me")
     */
    const setObjectKey = useCallback((parentPath, key, value) => {
        const segments = parsePath(parentPath);
        applyFormUpdate(prev => setAt(prev, [...segments, key], value));
    }, [applyFormUpdate]);

    /**
     * Delete a dynamic key from an object at any depth.
     * @param {Path} parentPath  Path to the object.
     * @param {string} key
     * @example
     * deleteObjectKey("socialLinks", "twitter")
     */
    const deleteObjectKey = useCallback((parentPath, key) => {
        const segments = parsePath(parentPath);
        applyFormUpdate(prev => deleteAt(prev, [...segments, key]));
    }, [applyFormUpdate]);

    /* ─────────────────────────────────────────────────────────
     * LIST OPERATIONS — work on arrays at any depth.
     * ───────────────────────────────────────────────────────── */

    /**
     * Append an item to an array at any depth.
     * Object items are deep-cloned so the template isn't mutated.
     * @param {Path} listPath
     * @param {*} item
     * @example
     * addItem("tags", { name: "", color: "blue" })
     * addItem("sections.0.blocks", { type: "text", content: "" })
     */
    const addItem = useCallback((listPath, item) => {
        const safeItem = item != null && typeof item === "object" ? deepClone(item) : item;
        applyFormUpdate(prev => updateArrayAt(prev, listPath, list => list.push(safeItem)));
    }, [applyFormUpdate]);

    /**
     * Insert an item at a specific index.
     * @param {Path} listPath
     * @param {number} index
     * @param {*} item
     * @example
     * insertItem("sections.0.blocks", 1, { type: "image" })
     */
    const insertItem = useCallback((listPath, index, item) => {
        const safeItem = item != null && typeof item === "object" ? deepClone(item) : item;
        applyFormUpdate(prev => updateArrayAt(prev, listPath, list => list.splice(index, 0, safeItem)));
    }, [applyFormUpdate]);

    /**
     * Remove an item by index from a list at any depth.
     * @param {Path} listPath
     * @param {number} index
     * @example removeItem("sections.0.blocks", 2)
     */
    const removeItem = useCallback((listPath, index) => {
        applyFormUpdate(prev => updateArrayAt(prev, listPath, list => list.splice(index, 1)));
    }, [applyFormUpdate]);

    /**
     * Update one field of one item in a list.
     * @param {Path} listPath
     * @param {number} index
     * @param {string} fieldName
     * @param {*} value
     * @example
     * updateItem("heroStats", 0, "value", "5+")
     * updateItem("sections.0.blocks", 2, "content", "New text")
     */
    const updateItem = useCallback((listPath, index, fieldName, value) => {
        const segments = parsePath(listPath);
        applyFormUpdate(prev => setAt(prev, [...segments, index, fieldName], value));
    }, [applyFormUpdate]);

    /**
     * Replace an entire item at an index.
     * @param {Path} listPath
     * @param {number} index
     * @param {*} item
     * @example replaceItem("sections", 0, { heading: "New", blocks: [] })
     */
    const replaceItem = useCallback((listPath, index, item) => {
        const segments = parsePath(listPath);
        applyFormUpdate(prev => setAt(prev, [...segments, index], item));
    }, [applyFormUpdate]);

    /**
     * Move an item from one index to another (drag-and-drop reordering).
     * @param {Path} listPath
     * @param {number} fromIndex
     * @param {number} toIndex
     * @example moveItem("sections", 3, 0)
     */
    const moveItem = useCallback((listPath, fromIndex, toIndex) => {
        applyFormUpdate(prev => updateArrayAt(prev, listPath, list => {
            const [item] = list.splice(fromIndex, 1);
            list.splice(toIndex, 0, item);
        }));
    }, [applyFormUpdate]);

    /**
     * Swap two items in a list by index.
     * @param {Path} listPath
     * @param {number} indexA
     * @param {number} indexB
     * @example swapItems("tags", 0, 1)
     */
    const swapItems = useCallback((listPath, indexA, indexB) => {
        applyFormUpdate(prev => updateArrayAt(prev, listPath, list => {
            [list[indexA], list[indexB]] = [list[indexB], list[indexA]];
        }));
    }, [applyFormUpdate]);

    /**
     * Duplicate an item in place — deep clone inserted right after the original.
     * Deep-clones the item so nested structures don't share references.
     * @param {Path} listPath
     * @param {number} index
     * @example duplicateItem("sections.0.blocks", 1)
     */
    const duplicateItem = useCallback((listPath, index) => {
        applyFormUpdate(prev => updateArrayAt(prev, listPath, list => {
            list.splice(index + 1, 0, deepClone(list[index]));
        }));
    }, [applyFormUpdate]);

    /**
     * Replace the entire array at a path.
     * @param {Path} listPath
     * @param {Array} items
     * @example setList("tags", [])
     */
    const setList = useCallback((listPath, items) => {
        applyFormUpdate(prev => setAt(prev, listPath, items));
    }, [applyFormUpdate]);

    /**
     * Clear a list (set to `[]`).
     * @param {Path} listPath
     */
    const clearList = useCallback((listPath) => {
        applyFormUpdate(prev => setAt(prev, listPath, []));
    }, [applyFormUpdate]);

    /* ─────────────────────────────────────────────────────────
     * SORTING & REORDERING
     * ───────────────────────────────────────────────────────── */

    /**
     * Sort an array at any depth by a field key (or by the items themselves
     * for primitive arrays). Supports `"asc"` / `"desc"`.
     *
     * Comparison rules:
     *   - Numbers  → numeric.
     *   - Strings  → case-insensitive locale-aware.
     *   - Dates / ISO-8601 strings → chronological.
     *   - Booleans → false before true (ascending).
     *   - null / undefined → always sorted to the end.
     *   - Mixed types → string comparison fallback.
     *
     * @param {Path} listPath
     * @param {string | null} [sortKey=null]  Field to sort by; null for primitives.
     * @param {SortDirection} [direction="asc"]
     * @example
     * sortList("faqItems", "sortOrder")
     * sortList("faqItems", "question", "desc")
     * sortList("tags", null, "asc")
     */
    const sortList = useCallback((listPath, sortKey = null, direction = "asc") => {
        applyFormUpdate(prev => updateArrayAt(prev, listPath, list => {
            list.sort((a, b) => {
                const av = sortKey != null ? a?.[sortKey] : a;
                const bv = sortKey != null ? b?.[sortKey] : b;

                if (av == null && bv == null) return 0;
                if (av == null) return 1;
                if (bv == null) return -1;

                let comparison = 0;
                if (typeof av === "number" && typeof bv === "number") {
                    comparison = av - bv;
                } else if (typeof av === "boolean" && typeof bv === "boolean") {
                    comparison = av === bv ? 0 : av ? 1 : -1;
                } else {
                    const dateA = new Date(av);
                    const dateB = new Date(bv);
                    if (!isNaN(dateA) && !isNaN(dateB) && typeof av === "string" && typeof bv === "string") {
                        comparison = dateA.getTime() - dateB.getTime();
                    } else {
                        comparison = String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
                    }
                }
                return direction === "desc" ? -comparison : comparison;
            });
        }));
    }, [applyFormUpdate]);

    /**
     * Drag-and-drop reorder — move an item from one index to another.
     * Semantic alias of `moveItem` for drag-and-drop handlers.
     * Almost always followed by `normalizeSortOrder`.
     *
     * @param {Path} listPath
     * @param {number} fromIndex
     * @param {number} toIndex
     * @example
     * function handleDragEnd({ active, over }) {
     *     if (!over || active.id === over.id) return;
     *     const from = items.findIndex(i => i.id === active.id);
     *     const to   = items.findIndex(i => i.id === over.id);
     *     fs.reorderList("faqItems", from, to);
     *     fs.normalizeSortOrder("faqItems", "sortOrder");
     * }
     */
    const reorderList = moveItem; // semantic alias — identical behaviour

    /**
     * Re-stamp a numeric sort-order field so it matches each item's
     * current array position. Call after `reorderList` or `sortList`
     * to keep the DB column in sync with the UI order.
     *
     * @param {Path} listPath
     * @param {string} orderFieldName  Field name on each item (e.g. `"sortOrder"`).
     * @param {Object} [options]
     * @param {number} [options.startAt=0]  Value assigned to the first item.
     * @example
     * fs.reorderList("faqItems", from, to);
     * fs.normalizeSortOrder("faqItems", "sortOrder");
     * // faqItems[0].sortOrder === 0, faqItems[1].sortOrder === 1, …
     */
    const normalizeSortOrder = useCallback((listPath, orderFieldName, { startAt = 0 } = {}) => {
        applyFormUpdate(prev => updateArrayAt(prev, listPath, list => {
            list.forEach((item, index) => {
                if (item && typeof item === "object") {
                    item[orderFieldName] = startAt + index;
                }
            });
        }));
    }, [applyFormUpdate]);

    /* ─────────────────────────────────────────────────────────
     * FILE & MEDIA
     * ───────────────────────────────────────────────────────── */

    /**
     * Returns a stable setter for a named file input slot.
     * Pass the return value directly to an `<ImagePickerField setValue={...} />`.
     * @param {string} slotName
     * @returns {function(File[]): void}
     * @example
     * <ImagePickerField setValue={fileSetterFor("avatar")} value={pendingFiles.avatar ?? []} />
     */
    const fileSetterFor = useCallback((slotName) => (fileList) => {
        setPendingFiles(prev => ({ ...prev, [slotName]: fileList }));
    }, []);

    /**
     * Clear all pending files for a slot.
     * @param {string} slotName
     */
    const clearPendingFilesFor = useCallback((slotName) => {
        setPendingFiles(prev => ({ ...prev, [slotName]: [] }));
    }, []);

    /**
     * Clear a preview URL field and flag it in `removedMediaKeys` so the
     * server action knows to null it in the database on save.
     * @param {Path} urlFieldPath
     * @example removeMedia("avatarUrl")
     */
    const removeMedia = useCallback((urlFieldPath) => {
        const key = toPathKey(urlFieldPath);
        applyFormUpdate(prev => setAt(prev, urlFieldPath, ""));
        setRemovedMediaKeys(prev => ({ ...prev, [key]: true }));
    }, [applyFormUpdate]);

    /**
     * Undo a `removeMedia` call. Restores the URL from the saved snapshot
     * and clears the removed flag.
     * @param {Path} urlFieldPath
     */
    const undoRemoveMedia = useCallback((urlFieldPath) => {
        const key = toPathKey(urlFieldPath);
        const restoredUrl = getAt(savedSnapshotRef.current, urlFieldPath) ?? "";
        applyFormUpdate(prev => setAt(prev, urlFieldPath, restoredUrl));
        setRemovedMediaKeys(prev => {
            const { [key]: _removed, ...rest } = prev;
            return rest;
        });
    }, [applyFormUpdate]);

    /* ─────────────────────────────────────────────────────────
     * TOUCHED & ERRORS
     * ───────────────────────────────────────────────────────── */

    /**
     * Mark a field as touched (typically called on blur).
     * @param {Path} path
     */
    const touchField = useCallback((path) => {
        const key = toPathKey(path);
        setTouchedFields(prev => (prev[key] ? prev : { ...prev, [key]: true }));
    }, []);

    /**
     * Unmark a field as touched.
     * @param {Path} path
     */
    const untouchField = useCallback((path) => {
        const key = toPathKey(path);
        setTouchedFields(prev => {
            if (!prev[key]) return prev;
            const { [key]: _removed, ...rest } = prev;
            return rest;
        });
    }, []);

    /**
     * Mark every reachable leaf path as touched.
     * Called automatically on a failed submit to reveal all errors at once.
     */
    const touchAllFields = useCallback(() => {
        const allTouched = {};
        function walkLeaves(node, prefix) {
            if (
                node == null ||
                typeof node !== "object" ||
                node instanceof Date ||
                node instanceof File
            ) {
                if (prefix) allTouched[prefix] = true;
                return;
            }
            if (Array.isArray(node)) {
                if (node.length === 0 && prefix) allTouched[prefix] = true;
                node.forEach((item, i) => walkLeaves(item, prefix ? `${prefix}.${i}` : String(i)));
                return;
            }
            const keys = Object.keys(node);
            if (keys.length === 0 && prefix) allTouched[prefix] = true;
            for (const k of keys) walkLeaves(node[k], prefix ? `${prefix}.${k}` : k);
        }
        walkLeaves(latestFormRef.current, "");
        setTouchedFields(allTouched);
    }, []);

    /**
     * Has this field been interacted with?
     * @param {Path} path
     * @returns {boolean}
     */
    const isFieldTouched = useCallback((path) => !!touchedFields[toPathKey(path)], [touchedFields]);

    /**
     * Manually set an error on a field (e.g. from a server validation response).
     * @param {Path} path
     * @param {string} message
     */
    const setFieldError = useCallback((path, message) => {
        setFieldErrors(prev => ({ ...prev, [toPathKey(path)]: message }));
    }, []);

    /**
     * Clear one field's error.
     * @param {Path} path
     */
    const clearFieldError = useCallback((path) => {
        const key = toPathKey(path);
        setFieldErrors(prev => {
            if (!prev[key]) return prev;
            const { [key]: _removed, ...rest } = prev;
            return rest;
        });
    }, []);

    /** Clear every error at once. */
    const clearAllErrors = useCallback(() => setFieldErrors({}), []);

    /**
     * Get the error message for a field — but only after the field
     * has been touched OR a submit has been attempted.
     * Returns `null` when there is nothing to show.
     * Use directly in JSX: `<TextField error={fs.errorFor("title")} />`
     * @param {Path} path
     * @returns {string | null}
     */
    const errorFor = useCallback((path) => {
        const key = toPathKey(path);
        if (!fieldErrors[key]) return null;
        if (submitAttemptCount > 0 || touchedFields[key]) return fieldErrors[key];
        return null;
    }, [fieldErrors, touchedFields, submitAttemptCount]);

    /* ─────────────────────────────────────────────────────────
     * DIRTY HELPERS
     * ───────────────────────────────────────────────────────── */

    /**
     * Check whether a specific field (or subtree) differs from the snapshot.
     * @param {Path} path
     * @returns {boolean}
     * @example
     * const isTitleDirty   = fs.isDirtyAt("title");
     * const isAddressDirty = fs.isDirtyAt("address");       // true if any child changed
     * const isRowDirty     = fs.isDirtyAt("sections.0");
     */
    const isDirtyAt = useCallback((path) => {
        return !deepEqual(
            getAt(latestFormRef.current, path),
            getAt(savedSnapshotRef.current, path),
        );
    }, []);

    /* ─────────────────────────────────────────────────────────
     * SUBMIT / RESET / SYNC
     * ───────────────────────────────────────────────────────── */

    /**
     * Validate, then run `onSubmit` if valid.
     * On failure marks every leaf field touched so errors become visible.
     * @returns {Promise<boolean>} `true` if `onSubmit` ran (validation passed).
     */
    const submit = useCallback(async () => {
        setSubmitAttemptCount(c => c + 1);
        const currentForm = latestFormRef.current;
        const errors = runValidationPure(currentForm);
        setFieldErrors(errors);
        setHasRunValidation(true);

        if (Object.keys(errors).length > 0) {
            touchAllFields();
            return false;
        }

        const submitHandler = onSubmitRef.current;
        if (!submitHandler) return true;

        try {
            setIsSubmitting(true);
            await submitHandler(currentForm, { pendingFiles, removedMediaKeys });
            return true;
        } finally {
            setIsSubmitting(false);
        }
    }, [pendingFiles, removedMediaKeys, runValidationPure, touchAllFields]);

    /**
     * Revert all unsaved changes back to the saved snapshot.
     * Clears pending files, removed media flags, errors, touched state,
     * and submit count.
     */
    const reset = useCallback(() => {
        setForm(savedSnapshotRef.current);
        setPendingFiles({});
        setRemovedMediaKeys({});
        setFieldErrors({});
        setTouchedFields({});
        setSubmitAttemptCount(0);
        setHasRunValidation(false);
    }, []);

    /**
     * Call after a successful save with the fresh server response.
     * Updates the snapshot so `isDirty` becomes `false`, and clears
     * pending files, removed flags, errors, and touched state.
     * @param {Object} freshServerData
     */
    const syncAfterSave = useCallback((freshServerData) => {
        const freshShape = buildFormShapeRef.current(freshServerData);
        setSavedSnapshot(freshShape);
        setForm(freshShape);
        setPendingFiles({});
        setRemovedMediaKeys({});
        setFieldErrors({});
        setTouchedFields({});
        setSubmitAttemptCount(0);
        setHasRunValidation(false);
    }, []);

    // ── Stable refs for snapshot reads inside callbacks ──────────────────
    // (Placed after state declarations so the ref is always current)
    const savedSnapshotRef = useRef(savedSnapshot);
    savedSnapshotRef.current = savedSnapshot;

    /* ─────────────────────────────────────────────────────────
     * Return
     * ───────────────────────────────────────────────────────── */

    return {
        // ── State ──────────────────────────────────────────────────────────
        form,                // Live form values. Reflects every edit.
        savedSnapshot,       // Last-saved baseline. Matches server data after save/sync.
        isDirty,             // true when form differs from savedSnapshot (or files/media pending).
        dirtyFields,         // { "dot.path": true } for each leaf that changed from snapshot.
        fieldErrors,         // { "dot.path": "error message" } for all invalid fields.
        isValid,             // true after validation has run AND there are no errors.
        touchedFields,       // { "dot.path": true } for fields the user has interacted with.
        isSubmitting,        // true while the onSubmit handler is awaiting.
        submitAttemptCount,  // Number of submit() calls. Drives "show errors after first attempt".
        hasRunValidation,    // true after the first validation run (validateNow, submit, or validateOnChange).

        // ── General value ops ──────────────────────────────────────────────
        set,            // set("a.b.c", value)         → update any value anywhere.
        setMany,        // setMany([["a", 1], ["b.c", 2]]) → batch update, one render.
        get,            // get("a.b.c")                → read from live form.
        getSnapshotValue, // getSnapshotValue("a.b.c") → read from saved snapshot.
        removeField,    // removeField("a.b.c")        → delete a key OR array index.
        merge,          // merge({...}, "path")        → shallow-merge a patch at a path.

        // ── Object helpers ─────────────────────────────────────────────────
        setObjectKey,   // setObjectKey("links", "tiktok", url)  → add/update a dynamic key.
        deleteObjectKey,// deleteObjectKey("links", "twitter")   → remove a dynamic key.

        // ── List ops ───────────────────────────────────────────────────────
        addItem,        // addItem("list", item)                 → append (deep-clones item).
        insertItem,     // insertItem("list", index, item)       → insert at index.
        removeItem,     // removeItem("list", index)             → remove by index.
        updateItem,     // updateItem("list", index, field, v)   → update one field of one item.
        replaceItem,    // replaceItem("list", index, item)      → replace a whole item.
        moveItem,       // moveItem("list", from, to)            → reposition.
        swapItems,      // swapItems("list", i, j)               → swap two items.
        duplicateItem,  // duplicateItem("list", index)          → deep-clone in place.
        setList,        // setList("list", newArray)             → replace the entire list.
        clearList,      // clearList("list")                     → empty the list ([]).

        // ── Sorting & reordering ───────────────────────────────────────────
        sortList,           // sortList("list", "field", "asc")        → sort by field.
        reorderList,        // reorderList("list", from, to)           → drag-drop alias of moveItem.
        normalizeSortOrder, // normalizeSortOrder("list", "sortOrder") → re-stamp order field.

        // ── Files & media ──────────────────────────────────────────────────
        pendingFiles,         // { slotName: File[] }  Files staged for upload.
        fileSetterFor,        // fileSetterFor("avatar") → setter for ImagePickerField.
        clearPendingFilesFor, // clearPendingFilesFor("avatar") → discard staged files.
        removedMediaKeys,     // { urlField: true }  Preview URLs cleared by the user.
        removeMedia,          // removeMedia("avatarUrl") → clear URL + flag for DB null.
        undoRemoveMedia,      // undoRemoveMedia("avatarUrl") → restore from snapshot.

        // ── Dirty helpers ──────────────────────────────────────────────────
        isDirtyAt,      // isDirtyAt("section.field") → per-field/subtree dirty check.

        // ── Touched & errors ───────────────────────────────────────────────
        touchField,     // touchField("name")        → mark touched (call on blur).
        untouchField,   // untouchField("name")      → unmark touched.
        touchAllFields, // touchAllFields()          → mark all leaves touched.
        isFieldTouched, // isFieldTouched("name")    → has user interacted with field?
        setFieldError,  // setFieldError("email", "Taken") → set error from server.
        clearFieldError,// clearFieldError("email")  → clear one field's error.
        clearAllErrors, // clearAllErrors()          → wipe all errors.
        errorFor,       // errorFor("name") → error string if touched/submitted, else null.
        validateNow,    // validateNow()    → run validation now; returns isValid boolean.

        // ── Lifecycle ──────────────────────────────────────────────────────
        submit,         // submit()              → validate → onSubmit. Returns true on success.
        reset,          // reset()               → discard all edits back to savedSnapshot.
        syncAfterSave,  // syncAfterSave(data)   → update snapshot after a successful save.
    };
}