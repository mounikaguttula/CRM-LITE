import { useState, useRef, useCallback, useEffect } from "react";
import Toast from '../../../components/Toast';


// ─── Template Definitions ───────────────────────────────────────────────────



function formatConditionLine(field, operator, value) {
  const safeField = field || "field";
  const safeOperator = operator || "=";
  const safeValue = value ?? "";

  if (safeOperator === "is empty" || safeOperator === "is not empty") {
    return `${safeField} ${safeOperator}`;
  }

  return `${safeField} ${safeOperator} '${safeValue}'`;
}


function buildNestedIfPseudoSQL(cfg = {}) {
  const innerConditions = Array.isArray(cfg.innerConditions) ? cfg.innerConditions : [];
  const lines = [
    `IF ${formatConditionLine(cfg.field, cfg.operator, cfg.value)}`,
    `  → ${cfg.trueLabel || "Yes"}`,
  ];

  innerConditions.forEach((innerCfg, index) => {
    const indent = "  ";
    lines.push(`${indent}IF ${formatConditionLine(innerCfg.field, innerCfg.operator, innerCfg.value)}`);
    lines.push(`${indent}  → ${innerCfg.trueLabel || `Inner True ${index + 1}`}`);
    lines.push(`${indent}ELSE`);
    lines.push(`${indent}  → ${innerCfg.falseLabel || `Inner False ${index + 1}`}`);
    lines.push(`${indent}END IF`);
  });

  lines.push("ELSE");
  lines.push(`  → ${cfg.falseLabel || "No"}`);
  lines.push("END IF");

  return lines.join("\n");
}

function buildDecisionPseudoSQL(cfg = {}) {
  const outcomes = Array.isArray(cfg.outcomes) ? cfg.outcomes : (Array.isArray(cfg.conditions) ? cfg.conditions : []);
  const lines = [
    `DECISION`,
  ];

  if (outcomes.length === 0) {
    lines.push("  (no conditions)");
  } else {
    outcomes.forEach((o, idx) => {
      const label = o.label || `Outcome ${idx + 1}`;
      const logic = o.logic || "AND";
      const conds = Array.isArray(o.conditions) ? o.conditions : (o.field ? [o] : []);

      if (conds.length === 0) {
        lines.push(`  + [${label}] IF (empty)`);
      } else {
        const condStrs = conds.map(c => formatConditionLine(c.field, c.operator, c.value));
        lines.push(`  + [${label}] IF ${condStrs.join(` ${logic} `)}`);
      }
    });
  }

  lines.push(`  + [${cfg.falseLabel || "Default"}] OTHERWISE`);
  return lines.join("\n");
}


const TEMPLATE_DEFS = {
  get_records: {
    id: "get_records",
    label: "Get Records",
    category: "trigger",
    color: "#7c3aed",
    bg: "#ede9fe",
    icon: "⬇",
    description: "Fetch records from the database",
    defaultConfig: {
      table: "contacts",
      filters: [{ field: "status", operator: "=", value: "active" }],
      limit: 100,
      orderBy: "created_at",
      orderDir: "DESC",
    },
    configFields: [
      { key: "table", label: "Table", type: "select", options: ["contacts", "leads", "deals", "companies", "tasks"] },
      { key: "filters", label: "Filters", type: "filters" },
      { key: "limit", label: "Limit", type: "number", min: 1, max: 10000 },
      { key: "orderBy", label: "Order By", type: "text" },
      { key: "orderDir", label: "Direction", type: "select", options: ["ASC", "DESC"] },
    ],
    outputs: ["records"],
    pseudoSQL: (cfg) =>
      `SELECT * FROM ${cfg.table}${cfg.filters?.length ? `\nWHERE ${cfg.filters.map(f => `${f.field} ${f.operator} '${f.value}'`).join(" AND ")}` : ""}\nORDER BY ${cfg.orderBy} ${cfg.orderDir}\nLIMIT ${cfg.limit};`,
  },
  if_condition: {
    id: "if_condition",
    label: "Decision",
    category: "logic",
    color: "#d97706",
    bg: "#fef3c7",
    icon: "◇",
    description: "Branch flow based on multiple conditions",
    defaultConfig: {
      outcomes: [
        {
          id: "outcome_1",
          label: "Yes",
          logic: "AND",
          conditions: [{ id: "cond_1", field: "score", operator: ">", value: "80" }]
        }
      ],
      falseLabel: "No (Default)",
    },
    configFields: [
      { key: "outcomes", label: "Outcomes", type: "decision_conditions" },
      { key: "falseLabel", label: "Default Outcome Label", type: "text" },
    ],
    outputs: (cfg) => {
      const ports = [];
      const list = Array.isArray(cfg.outcomes) ? cfg.outcomes : (Array.isArray(cfg.conditions) ? cfg.conditions : []);
      list.forEach((c, idx) => ports.push(c.id || `outcome_${idx}`));
      ports.push("false");
      return ports;
    },
    outputLabels: (cfg) => {
      const labels = {};
      const list = Array.isArray(cfg.outcomes) ? cfg.outcomes : (Array.isArray(cfg.conditions) ? cfg.conditions : []);
      list.forEach((c, idx) => {
        labels[c.id || `outcome_${idx}`] = c.label || `Outcome ${idx + 1}`;
      });
      labels["false"] = cfg.falseLabel || "Default";
      return labels;
    },
    pseudoSQL: (cfg) => buildDecisionPseudoSQL(cfg),
  },
  nested_if: {
    id: "nested_if",
    label: "Nested If",
    category: "logic",
    color: "#ca8a04",
    bg: "#fef08a",
    icon: "◇",
    description: "If with nested inner conditions inside",
    defaultConfig: {
      field: "amount",
      operator: ">",
      value: "1000",
      trueLabel: "Yes",
      falseLabel: "No",
      innerConditions: [],
    },
    configFields: [
      { key: "field", label: "Field", type: "text" },
      { key: "operator", label: "Operator", type: "select", options: [">", "<", "=", "!=", ">=", "<=", "contains", "not contains", "is empty", "is not empty"] },
      { key: "value", label: "Value", type: "text" },
      { key: "trueLabel", label: "True branch label", type: "text" },
      { key: "falseLabel", label: "False branch label", type: "text" },
      { key: "innerConditions", label: "Inner IF conditions (nested)", type: "innerif" },
    ],
    outputs: ["true", "false"],
    pseudoSQL: (cfg) => buildNestedIfPseudoSQL(cfg),
  },
  for_loop: {
    id: "for_loop",
    label: "For Loop",
    category: "logic",
    color: "#d97706",
    bg: "#fef3c7",
    icon: "↻",
    description: "Iterate over a list of records",
    defaultConfig: {
      inputVar: "records",
      iteratorVar: "record",
      maxIterations: 1000,
    },
    configFields: [
      { key: "inputVar", label: "Input list", type: "text" },
      { key: "iteratorVar", label: "Iterator variable", type: "text" },
      { key: "maxIterations", label: "Max iterations", type: "number", min: 1, max: 10000 },
    ],
    outputs: ["for_each", "after_last"],
    pseudoSQL: (cfg) => `FOR EACH ${cfg.iteratorVar} IN ${cfg.inputVar}\n  (up to ${cfg.maxIterations} iterations)\n  → execute body\nEND FOR`,
  },
  send_email: {
    id: "send_email",
    label: "Send Email",
    category: "action",
    color: "#0891b2",
    bg: "#cffafe",
    icon: "✉",
    description: "Send an email to a contact",
    defaultConfig: {
      to: "{{record.email}}",
      from: "noreply@company.com",
      subject: "Hello {{record.name}}",
      body: "Hi {{record.name}},\n\nThank you for...",
      templateId: "",
    },
    configFields: [
      { key: "to", label: "To", type: "text" },
      { key: "from", label: "From", type: "text" },
      { key: "subject", label: "Subject", type: "text" },
      { key: "body", label: "Body", type: "textarea" },
      { key: "templateId", label: "Email Template ID (optional)", type: "text" },
    ],
    outputs: ["sent", "failed"],
    pseudoSQL: (cfg) => `SEND EMAIL\n  TO: ${cfg.to}\n  FROM: ${cfg.from}\n  SUBJECT: "${cfg.subject}"\n  BODY: [template]`,
  },
  create_record: {
    id: "create_record",
    label: "Create Record",
    category: "action",
    color: "#059669",
    bg: "#d1fae5",
    icon: "+",
    description: "Insert a new record into the database",
    defaultConfig: {
      table: "contacts",
      fields: [{ key: "status", value: "new" }, { key: "source", value: "automation" }],
    },
    configFields: [
      { key: "table", label: "Table", type: "select", options: ["contacts", "leads", "deals", "companies", "tasks"] },
      { key: "fields", label: "Fields to set", type: "keyvalue" },
    ],
    outputs: ["created_record"],
    pseudoSQL: (cfg) =>
      `INSERT INTO ${cfg.table}\n  (${cfg.fields?.map(f => f.key).join(", ")})\nVALUES\n  (${cfg.fields?.map(f => `'${f.value}'`).join(", ")});`,
  },
  update_record: {
    id: "update_record",
    label: "Update Record",
    category: "action",
    color: "#2563eb",
    bg: "#dbeafe",
    icon: "✎",
    description: "Update an existing record in the database",
    defaultConfig: {
      table: "contacts",
      recordId: "{{record.id}}",
      fields: [{ key: "status", value: "processed" }],
    },
    configFields: [
      { key: "table", label: "Table", type: "select", options: ["contacts", "leads", "deals", "companies", "tasks"] },
      { key: "recordId", label: "Record ID", type: "text" },
      { key: "fields", label: "Fields to update", type: "keyvalue" },
    ],
    outputs: ["updated_record"],
    pseudoSQL: (cfg) =>
      `UPDATE ${cfg.table}\nSET ${cfg.fields?.map(f => `${f.key} = '${f.value}'`).join(",\n    ")}\nWHERE id = ${cfg.recordId};`,
  },
  delete_record: {
    id: "delete_record",
    label: "Delete Record",
    category: "action",
    color: "#dc2626",
    bg: "#fee2e2",
    icon: "✕",
    description: "Delete a record from the database",
    defaultConfig: {
      table: "contacts",
      recordId: "{{record.id}}",
      softDelete: true,
    },
    configFields: [
      { key: "table", label: "Table", type: "select", options: ["contacts", "leads", "deals", "companies", "tasks"] },
      { key: "recordId", label: "Record ID", type: "text" },
      { key: "softDelete", label: "Soft delete (set deleted_at)", type: "boolean" },
    ],
    outputs: ["deleted"],
    pseudoSQL: (cfg) =>
      cfg.softDelete
        ? `UPDATE ${cfg.table}\nSET deleted_at = NOW()\nWHERE id = ${cfg.recordId};`
        : `DELETE FROM ${cfg.table}\nWHERE id = ${cfg.recordId};`,
  },
  start: {
    id: "start",
    label: "Start",
    category: "trigger",
    color: "#10b981",
    bg: "#d1fae5",
    icon: "▶",
    description: "Flow entry point",
    defaultConfig: {},
    configFields: [],
    outputs: ["next"],
    pseudoSQL: () => "-- START FLOW",
  },
  end: {
    id: "end",
    label: "End",
    category: "terminal",
    color: "#ef4444",
    bg: "#fee2e2",
    icon: "⏹",
    description: "End of flow branch",
    defaultConfig: {},
    configFields: [],
    outputs: [],
    pseudoSQL: () => "-- END FLOW",
  },
};


const CATEGORIES = [
  { id: "trigger", label: "Trigger", color: "#7c3aed" },
  { id: "logic", label: "Logic", color: "#d97706" },
  { id: "action", label: "Action", color: "#059669" },
  { id: "terminal", label: "Terminal", color: "#ef4444" },
];


// ─── Helpers ─────────────────────────────────────────────────────────────────


function uid() {
  return Math.random().toString(36).slice(2, 9);
}


function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const GRID_SIZE = 20;
const NODE_WIDTH = 200;
const NODE_HEIGHT = 120;

function snapToGrid(val) {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

function formatOutputLabel(output) {
  return String(output || "")
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}


// ─── Config Editor Components ────────────────────────────────────────────────


function ResourcePicker({ value = "", onChange, resources, placeholder, onAddResource }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updateCoords = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        (containerRef.current && !containerRef.current.contains(event.target)) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updateCoords, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [updateCoords]);

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
      <input
        style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { updateCoords(); setOpen(true); }}
      />
      {open && (
        <div ref={dropdownRef} style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width, background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 9999, maxHeight: 240, overflowY: "auto" }}>
          {resources && resources.length > 0 ? (
            <>
              {["Variable", "Constant", "Formula", "Text Template"].map(type => {
                const items = resources.filter(r => r.type === type);
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <div style={{ padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "#9ca3af", background: "#f9fafb", textTransform: "uppercase" }}>{type}s</div>
                    {items.map(res => (
                      <div key={res.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const cursorText = `{!${res.apiName}}`;
                          const newVal = (value && !value.includes("{!")) ? value + " " + cursorText : cursorText;
                          onChange(newVal);
                          setOpen(false);
                        }}
                        style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                      >
                        <span style={{ fontWeight: 600 }}>{res.apiName}</span> <span style={{ color: "#9ca3af", fontSize: 11 }}>{res.dataType ? `(${res.dataType})` : ""}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{ borderTop: "1px solid #f3f4f6" }} />
            </>
          ) : null}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onAddResource) {
                onAddResource();
                setOpen(false);
              }
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 500,
              color: "#1d4ed8",
              background: "#fff",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.15s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#f0f4f8"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          >
            + New Resource
          </button>
        </div>
      )}
    </div>
  );
}


function FilterEditor({ value = [], onChange, resources, onAddResource }) {
  const ops = ["=", "!=", ">", "<", ">=", "<=", "contains", "is empty"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {value.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            style={{ flex: 1, fontSize: 12, padding: "3px 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
            placeholder="field"
            value={f.field}
            onChange={e => { const nv = [...value]; nv[i] = { ...f, field: e.target.value }; onChange(nv); }}
          />
          <select
            style={{ fontSize: 12, padding: "3px 4px", border: "1px solid #d1d5db", borderRadius: 4 }}
            value={f.operator}
            onChange={e => { const nv = [...value]; nv[i] = { ...f, operator: e.target.value }; onChange(nv); }}
          >
            {ops.map(o => <option key={o}>{o}</option>)}
          </select>
          <ResourcePicker
            placeholder="value"
            value={f.value}
            onChange={(val) => { const nv = [...value]; nv[i] = { ...f, value: val }; onChange(nv); }}
            resources={resources}
            onAddResource={onAddResource}
          />
          <button onClick={() => onChange(value.filter((_, j) => j !== i))}
            style={{ fontSize: 11, padding: "2px 6px", border: "1px solid #fca5a5", borderRadius: 4, background: "#fff", color: "#dc2626", cursor: "pointer" }}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...value, { field: "", operator: "=", value: "" }])}
        style={{ fontSize: 12, padding: "4px 8px", border: "1px dashed #9ca3af", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#6b7280" }}>
        + Add filter
      </button>
    </div>
  );
}


function KeyValueEditor({ value = [], onChange, resources, onAddResource }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {value.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            style={{ flex: 1, fontSize: 12, padding: "3px 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
            placeholder="field name"
            value={f.key}
            onChange={e => { const nv = [...value]; nv[i] = { ...f, key: e.target.value }; onChange(nv); }}
          />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>=</span>
          <ResourcePicker
            placeholder="value / {!variable}"
            value={f.value}
            onChange={(val) => { const nv = [...value]; nv[i] = { ...f, value: val }; onChange(nv); }}
            resources={resources}
            onAddResource={onAddResource}
          />
          <button onClick={() => onChange(value.filter((_, j) => j !== i))}
            style={{ fontSize: 11, padding: "2px 6px", border: "1px solid #fca5a5", borderRadius: 4, background: "#fff", color: "#dc2626", cursor: "pointer" }}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...value, { key: "", value: "" }])}
        style={{ fontSize: 12, padding: "4px 8px", border: "1px dashed #9ca3af", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#6b7280" }}>
        + Add field
      </button>
    </div>
  );
}


function InnerIfEditor({ value = [], onChange, resources, onAddResource }) {
  const ops = [">", "<", "=", "!=", ">=", "<=", "contains", "not contains", "is empty", "is not empty"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {value.map((inner, i) => (
        <div key={i} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Inner IF {i + 1}
            </span>
            <button
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              style={{
                marginLeft: "auto",
                fontSize: 11,
                padding: "2px 8px",
                border: "1px solid #fca5a5",
                borderRadius: 4,
                background: "#fff",
                color: "#dc2626",
                cursor: "pointer"
              }}
            >
              Remove
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <input
              style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}
              placeholder="field"
              value={inner.field || ""}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...inner, field: e.target.value };
                onChange(next);
              }}
            />
            <select
              style={{ fontSize: 12, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}
              value={inner.operator || ">"}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...inner, operator: e.target.value };
                onChange(next);
              }}
            >
              {ops.map(o => <option key={o}>{o}</option>)}
            </select>
            <input
              style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}
              placeholder="value"
              value={inner.value || ""}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...inner, value: e.target.value };
                onChange(next);
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <input
              style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}
              placeholder="True label"
              value={inner.trueLabel || ""}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...inner, trueLabel: e.target.value };
                onChange(next);
              }}
            />
            <input
              style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}
              placeholder="False label"
              value={inner.falseLabel || ""}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...inner, falseLabel: e.target.value };
                onChange(next);
              }}
            />
          </div>
        </div>
      ))}

      <button
        onClick={() => onChange([
          ...value,
          { field: "", operator: ">", value: "", trueLabel: "Yes", falseLabel: "No" }
        ])}
        style={{
          fontSize: 12,
          padding: "6px 8px",
          border: "1px dashed #9ca3af",
          borderRadius: 6,
          background: "transparent",
          cursor: "pointer",
          color: "#6b7280",
          fontWeight: 500
        }}
      >
        + Add inner IF
      </button>
    </div>
  );
}

function DecisionConditionsEditor({ value = [], onChange, resources, onAddResource }) {
  const ops = [">", "<", "=", "!=", ">=", "<=", "contains", "not contains", "is empty", "is not empty"];

  // Normalize legacy conditions into grouped outcomes
  const normalizedValue = value.map(v => {
    if (v.conditions) return v;
    return {
      id: v.id || Math.random().toString(36).substring(2, 9),
      label: v.label || "Outcome",
      logic: "AND",
      conditions: [{ id: Math.random().toString(36).substring(2, 9), field: v.field || "", operator: v.operator || "=", value: v.value || "" }]
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {normalizedValue.map((outcome, oIdx) => (
        <div key={outcome.id || oIdx} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fafafa" }}>

          {/* Outcome Header */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>
              Outcome {oIdx + 1}
            </span>
            <input
              style={{ flex: 1, fontSize: 13, padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontWeight: 600 }}
              placeholder="Label (e.g. High Priority)"
              value={outcome.label || ""}
              onChange={(e) => {
                const next = [...normalizedValue];
                next[oIdx] = { ...outcome, label: e.target.value };
                onChange(next);
              }}
            />
            <button
              onClick={() => onChange(normalizedValue.filter((_, j) => j !== oIdx))}
              style={{ fontSize: 11, padding: "4px 8px", border: "1px solid #fca5a5", borderRadius: 4, background: "#fff", color: "#dc2626", cursor: "pointer" }}
            >
              Remove
            </button>
          </div>

          {/* Condition Logic (AND/OR) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Condition Logic to Meet:</span>
            <select
              style={{ fontSize: 11, padding: "2px 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
              value={outcome.logic || "AND"}
              onChange={e => {
                const next = [...normalizedValue];
                next[oIdx] = { ...outcome, logic: e.target.value };
                onChange(next);
              }}
            >
              <option value="AND">All Conditions Are Met (AND)</option>
              <option value="OR">Any Condition Is Met (OR)</option>
            </select>
          </div>

          {/* Conditions List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(outcome.conditions || []).map((cond, cIdx) => (
              <div key={cond.id || cIdx} style={{ display: "flex", gap: 6, alignItems: "center", background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", width: 14 }}>{cIdx + 1}.</span>
                <input
                  style={{ flex: 1, fontSize: 12, padding: "4px 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
                  placeholder="Resource / Field"
                  value={cond.field || ""}
                  onChange={(e) => {
                    const next = [...normalizedValue];
                    const nextConds = [...outcome.conditions];
                    nextConds[cIdx] = { ...cond, field: e.target.value };
                    next[oIdx] = { ...outcome, conditions: nextConds };
                    onChange(next);
                  }}
                />
                <select
                  style={{ fontSize: 12, padding: "4px 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
                  value={cond.operator || "="}
                  onChange={(e) => {
                    const next = [...normalizedValue];
                    const nextConds = [...outcome.conditions];
                    nextConds[cIdx] = { ...cond, operator: e.target.value };
                    next[oIdx] = { ...outcome, conditions: nextConds };
                    onChange(next);
                  }}
                >
                  {ops.map(o => <option key={o}>{o}</option>)}
                </select>
                <div style={{ flex: 1 }}>
                  <ResourcePicker
                    placeholder="Value"
                    value={cond.value || ""}
                    onChange={(val) => {
                      const next = [...normalizedValue];
                      const nextConds = [...outcome.conditions];
                      nextConds[cIdx] = { ...cond, value: val };
                      next[oIdx] = { ...outcome, conditions: nextConds };
                      onChange(next);
                    }}
                    resources={resources}
                    onAddResource={onAddResource}
                  />
                </div>
                <button
                  onClick={() => {
                    const next = [...normalizedValue];
                    const nextConds = outcome.conditions.filter((_, j) => j !== cIdx);
                    next[oIdx] = { ...outcome, conditions: nextConds };
                    onChange(next);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}
                  title="Remove condition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const next = [...normalizedValue];
              const conds = outcome.conditions || [];
              next[oIdx] = {
                ...outcome,
                conditions: [...conds, { id: Math.random().toString(36).substring(2, 9), field: "", operator: "=", value: "" }]
              };
              onChange(next);
            }}
            style={{ marginTop: 8, fontSize: 11, padding: "4px 8px", border: "1px dashed #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", color: "#6b7280", fontWeight: 600, width: "fit-content" }}
          >
            + Add Condition
          </button>
        </div>
      ))}

      <button
        onClick={() => onChange([...normalizedValue, {
          id: Math.random().toString(36).substring(2, 9),
          label: `Outcome ${normalizedValue.length + 1}`,
          logic: "AND",
          conditions: [{ id: Math.random().toString(36).substring(2, 9), field: "", operator: "=", value: "" }]
        }])}
        style={{ fontSize: 13, padding: "10px", border: "1px dashed #6b7280", borderRadius: 6, background: "transparent", cursor: "pointer", color: "#374151", fontWeight: 600, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}
      >
        <span>+</span> Add Outcome Branch
      </button>
    </div>
  );
}


function ConfigPanel({ node, onClose, onUpdate, resources, onAddResource: onAddResourceProp }) {
  const def = TEMPLATE_DEFS[node.templateId];
  const [config, setConfig] = useState(deepClone(node.config));
  const [showInlineResourceModal, setShowInlineResourceModal] = useState(false);
  const [tempResources, setTempResources] = useState(resources);

  const set = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  const handleAddResource = () => {
    setShowInlineResourceModal(true);
  };

  const handleResourceSave = (newResource) => {
    setTempResources(prev => [...prev, newResource]);
    setShowInlineResourceModal(false);
    if (onAddResourceProp) {
      onAddResourceProp(newResource);
    }
  };

  const save = () => {
    onUpdate(node.id, config);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: 480, maxHeight: "85vh",
        display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)"
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", gap: 10
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8,
            background: def.bg, color: def.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700
          }}>{def.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{def.label}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{def.description}</div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: "auto", fontSize: 18, background: "none", border: "none",
            cursor: "pointer", color: "#9ca3af", lineHeight: 1
          }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {def.configFields.map(field => (
            <div key={field.key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                {field.label}
              </label>
              {field.type === "text" && (
                <ResourcePicker
                  placeholder={field.label}
                  value={config[field.key] || ""}
                  onChange={val => set(field.key, val)}
                  resources={tempResources}
                  onAddResource={handleAddResource}
                />
              )}
              {field.type === "number" && (
                <input type="number" value={config[field.key] || ""} min={field.min} max={field.max}
                  onChange={e => set(field.key, Number(e.target.value))}
                  style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
              )}
              {field.type === "select" && (
                <select value={config[field.key] || ""} onChange={e => set(field.key, e.target.value)}
                  style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}>
                  {field.options.map(o => <option key={o}>{o}</option>)}
                </select>
              )}
              {field.type === "textarea" && (
                <textarea value={config[field.key] || ""} onChange={e => set(field.key, e.target.value)}
                  rows={4}
                  style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
              )}
              {field.type === "boolean" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!config[field.key]} onChange={e => set(field.key, e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 13 }}>{config[field.key] ? "Enabled" : "Disabled"}</span>
                </label>
              )}
              {field.type === "filters" && (
                <FilterEditor value={config[field.key]} onChange={v => set(field.key, v)} resources={tempResources} onAddResource={handleAddResource} />
              )}
              {field.type === "keyvalue" && (
                <KeyValueEditor value={config[field.key]} onChange={v => set(field.key, v)} resources={tempResources} onAddResource={handleAddResource} />
              )}
              {field.type === "innerif" && (
                <InnerIfEditor value={config[field.key]} onChange={v => set(field.key, v)} resources={tempResources} onAddResource={handleAddResource} />
              )}
              {field.type === "decision_conditions" && (
                <DecisionConditionsEditor value={config[field.key] || []} onChange={v => set(field.key, v)} resources={tempResources} onAddResource={handleAddResource} />
              )}
            </div>
          ))}

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Generated code preview</div>
            <pre style={{
              background: "#1e1e2e", color: "#cdd6f4", borderRadius: 8,
              padding: "10px 14px", fontSize: 12, overflowX: "auto",
              margin: 0, lineHeight: 1.6, fontFamily: "monospace"
            }}>{def.pseudoSQL(config)}</pre>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: "7px 16px", fontSize: 13, border: "1px solid #d1d5db",
            borderRadius: 6, background: "#fff", cursor: "pointer"
          }}>Cancel</button>
          <button onClick={save} style={{
            padding: "7px 16px", fontSize: 13, border: "none",
            borderRadius: 6, background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600
          }}>Save</button>
        </div>
      </div>

      {/* Inline Resource Modal */}
      {showInlineResourceModal && (
        <ResourceModal
          onClose={() => setShowInlineResourceModal(false)}
          onSave={handleResourceSave}
        />
      )}
    </div>
  );
}


// ─── Flow Node Component ──────────────────────────────────────────────────────


function FlowNode({ node, isSelected, onSelect, onEdit, onDelete, onConnectStart, connectingFrom, onConnectEnd, onPositionChange, scale }) {
  const def = TEMPLATE_DEFS[node.templateId];
  const dragStart = useRef(null);
  const isDragging = useRef(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseDown = (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    e.stopPropagation();
    dragStart.current = { mx: e.clientX, my: e.clientY, nx: node.x, ny: node.y };
    isDragging.current = false;

    const move = (me) => {
      const dx = (me.clientX - dragStart.current.mx) / scale;
      const dy = (me.clientY - dragStart.current.my) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 3) isDragging.current = true;
      if (isDragging.current) {
        const newX = snapToGrid(dragStart.current.nx + dx);
        const newY = snapToGrid(dragStart.current.ny + dy);
        onPositionChange(node.id, newX, newY);
      }
    };
    const up = () => {
      if (!isDragging.current) onSelect(node.id);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const isConnectTarget = connectingFrom && connectingFrom !== node.id;
  const sidePorts = [
    { side: "top", style: { top: -6, left: "50%", transform: "translateX(-50%)" } },
    { side: "right", style: { top: "50%", right: -6, transform: "translateY(-50%)" } },
    { side: "bottom", style: { bottom: -6, left: "50%", transform: "translateX(-50%)" } },
    { side: "left", style: { top: "50%", left: -6, transform: "translateY(-50%)" } },
  ];

  return (
    <div
      id={`node-${node.id}`}
      onDoubleClick={() => onEdit(node.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        height: "auto",
        background: "#fff",
        border: `2px solid ${isSelected ? def.color : isConnectTarget ? "#10b981" : isHovered ? def.color + "88" : "#e5e7eb"}`,
        borderRadius: 10,
        boxShadow: isSelected
          ? `0 0 0 3px ${def.color}33, 0 0 0 1px rgba(0,0,0,.08), 0 4px 20px rgba(0,0,0,0.12)`
          : isHovered
            ? `0 0 0 1px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,0.10)`
            : "0 0 0 1px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04), 0 12px 24px rgba(0,0,0,.05)",
        cursor: connectingFrom && connectingFrom !== node.id ? "pointer" : "grab",
        userSelect: "none",
        transition: "border-color 0.15s, box-shadow 0.2s",
        zIndex: isSelected ? 10 : isHovered ? 5 : 1,
      }}
      onMouseDown={(e) => {
        if (e.target.closest("button")) return;
        if (connectingFrom && connectingFrom !== node.id) {
          e.stopPropagation();
          // Body click uses top handle; explicit side handles are available on ports.
          onConnectEnd(node.id, "top");
          return;
        }
        handleMouseDown(e);
      }}
    >
      {/* Input ports */}
      {(node.templateId === "for_loop" ? sidePorts : [sidePorts[0]]).map((port) => (
        <div
          key={port.side}
          style={{
            position: "absolute",
            ...port.style,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: isConnectTarget ? "#10b981" : "#fff",
            border: `2px solid ${isConnectTarget ? "#10b981" : "#9ca3af"}`,
            cursor: isConnectTarget ? "pointer" : "default",
            zIndex: 20,
            transition: "all 0.15s",
          }}
          onMouseDown={(e) => {
            if (connectingFrom && connectingFrom !== node.id) {
              e.stopPropagation();
              onConnectEnd(node.id, port.side);
            }
          }}
        />
      ))}

      {/* Node header */}
      <div style={{
        background: def.bg,
        borderRadius: "8px 8px 0 0",
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: `1px solid ${def.color}33`
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 6,
          background: def.color, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, flexShrink: 0
        }}>{def.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: def.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {def.label}
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {def.category}
          </div>
        </div>
      </div>

      {/* Node body */}
      <div style={{ padding: "8px 12px" }}>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
          {node.templateId === "get_records" && <span>Table: <b style={{ color: "#374151" }}>{node.config.table}</b></span>}
          {node.templateId === "if_condition" && (
            <span>
              {Array.isArray(node.config.outcomes) ? `${node.config.outcomes.length} outcome(s)` :
                Array.isArray(node.config.conditions) ? `${node.config.conditions.length} outcome(s)` : "Decision"}
            </span>
          )}
          {node.templateId === "nested_if" && (
            <span>
              {(() => {
                const c = { field: node.config.field, operator: node.config.operator, value: node.config.value };
                return (
                  <>
                    <b style={{ color: "#374151" }}>{c.field}</b> {c.operator} <b style={{ color: "#374151" }}>{c.value}</b>
                  </>
                );
              })()}
            </span>
          )}
          {node.templateId === "for_loop" && <span>Each <b style={{ color: "#374151" }}>{node.config.iteratorVar}</b> in {node.config.inputVar}</span>}
          {node.templateId === "send_email" && <span>To: <b style={{ color: "#374151" }}>{node.config.to}</b></span>}
          {node.templateId === "create_record" && <span>Insert into <b style={{ color: "#374151" }}>{node.config.table}</b></span>}
          {node.templateId === "update_record" && <span>Update <b style={{ color: "#374151" }}>{node.config.table}</b></span>}
          {node.templateId === "delete_record" && <span>Delete from <b style={{ color: "#374151" }}>{node.config.table}</b></span>}
        </div>
      </div>

      {/* Output ports (bottom) */}
      {node.templateId !== "if_condition" && (
        <div style={{ padding: "0 12px 12px", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {(typeof def.outputs === 'function' ? def.outputs(node.config) : def.outputs).map((out) => {
            const label = typeof def.outputLabels === 'function' ? def.outputLabels(node.config)[out] : formatOutputLabel(out);
            return (
              <div key={out} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                <button
                  onMouseDown={e => { e.stopPropagation(); onConnectStart(node.id, out); }}
                  style={{
                    width: "100%",
                    fontSize: 11, padding: "6px 12px",
                    border: `1.5px solid ${def.color}55`,
                    borderRadius: 999,
                    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                    color: def.color, cursor: "crosshair",
                    fontWeight: 600, transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    minWidth: "fit-content",
                    boxShadow: "0 1px 2px rgba(15,23,42,0.08)"
                  }}
                  title={`Connect "${label}" output`}
                  onMouseEnter={e => e.currentTarget.style.borderColor = def.color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = `${def.color}55`}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons (visible on hover) */}
      <div style={{
        position: "absolute", top: -12, right: -8,
        display: "flex", gap: 4,
        opacity: isHovered || isSelected ? 1 : 0,
        transition: "opacity 0.15s",
        pointerEvents: isHovered || isSelected ? "auto" : "none",
      }}>
        <button onMouseDown={e => e.stopPropagation()} onClick={() => onEdit(node.id)}
          style={{
            width: 24, height: 24, borderRadius: "50%",
            background: "#fff", border: "1px solid #e5e7eb",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "#6b7280", boxShadow: "0 1px 4px rgba(0,0,0,0.12)"
          }} title="Configure">⚙</button>
        <button onMouseDown={e => e.stopPropagation()} onClick={() => onDelete(node.id)}
          style={{
            width: 24, height: 24, borderRadius: "50%",
            background: "#fff", border: "1px solid #fca5a5",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "#dc2626", boxShadow: "0 1px 4px rgba(0,0,0,0.12)"
          }} title="Delete">✕</button>
      </div>

      {connectingFrom === node.id && (
        <div style={{
          position: "absolute", inset: -3,
          border: "2px dashed #10b981",
          borderRadius: 12, pointerEvents: "none",
          animation: "pulse 1s infinite"
        }} />
      )}
    </div>
  );
}


// ─── Connection SVG (Orthogonal / Step Edges) ─────────────────────────────────


function Connections({ connections, nodes, mousePos, connectingFrom, onDeleteConnection, onInlineAddClick }) {
  const R = (v) => Math.round(v);

  const getDefaultSourceSide = (fromNode, output) => {
    if (!fromNode) return "bottom";
    if (fromNode.templateId === "for_loop") {
      return output === "after_last" ? "right" : "bottom";
    }
    if (fromNode.templateId === "nested_if") {
      return output === "false" ? "right" : "bottom";
    }
    if (fromNode.templateId === "if_condition") {
      return "bottom";
    }
    return "bottom";
  };

  // Get all anchor points for a node
  const getNodeAnchors = (nodeId) => {
    const n = nodes.find(n => n.id === nodeId);
    if (!n) return null;

    let h = NODE_HEIGHT;
    const el = document.getElementById(`node-${nodeId}`);
    if (el) {
      h = el.offsetHeight;
    }

    return {
      top: { x: R(n.x + NODE_WIDTH / 2), y: R(n.y) },
      bottom: { x: R(n.x + NODE_WIDTH / 2), y: R(n.y + h) },
      left: { x: R(n.x), y: R(n.y + h / 2) },
      right: { x: R(n.x + NODE_WIDTH), y: R(n.y + h / 2) },
    };
  };

  const getNodeBottom = (nodeId) => {
    const anchors = getNodeAnchors(nodeId);
    return anchors ? anchors.bottom : null;
  };

  const getNodeInputPoint = (nodeId, side = "top") => {
    const anchors = getNodeAnchors(nodeId);
    if (!anchors) return null;
    return anchors[side] || anchors.top;
  };

  const getConnectionPoints = (conn) => {
    const fromNode = nodes.find(n => n.id === conn.fromId);
    const toNode = nodes.find(n => n.id === conn.toId);
    if (!fromNode) return { from: null, to: null };

    const sourceSide = conn.meta?.fromSide || getDefaultSourceSide(fromNode, conn.output);
    const isAfterLastBranch = fromNode.templateId === "for_loop" && conn.output === "after_last";
    const isIfFalseBranch = fromNode.templateId === "nested_if" && conn.output === "false";
    const rawTargetSide = conn.meta?.toSide || "top";
    const isIterationLoopBack = conn.meta?.loopKind === "iteration";
    // Backward compatibility: old false-branch edges were saved as left; remap to top for downward skip/rejoin flows.
    const compatTargetSide = isIfFalseBranch && rawTargetSide === "left" && toNode && fromNode && toNode.y >= fromNode.y
      ? "top"
      : rawTargetSide;
    const targetSide = isIterationLoopBack
      ? "top"
      : isAfterLastBranch
        ? "left"
        : compatTargetSide;

    const from = getNodeInputPoint(conn.fromId, sourceSide);
    const to = getNodeInputPoint(conn.toId, targetSide);

    return { from, to, sourceSide, targetSide, isIterationLoopBack };
  };

  // Strict orthogonal routing: connect anchor to anchor with 90-degree segments
  const getOrthogonalPath = (x1, y1, x2, y2) => {
    x1 = R(x1); y1 = R(y1); x2 = R(x2); y2 = R(y2);
    const spacing = 28;

    if (Math.abs(x1 - x2) <= 0.5) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    if (Math.abs(y1 - y2) <= 0.5) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    if (y2 >= y1 + 40) {
      // Target below: down then across then down
      const midY = y1 + (y2 - y1) / 2;
      return `M ${x1} ${y1} L ${x1} ${R(midY)} L ${x2} ${R(midY)} L ${x2} ${y2}`;
    } else if (y2 < y1 - 40) {
      // Target above: up, then across, then up
      const midY = y1 - (y1 - y2) / 2;
      return `M ${x1} ${y1} L ${x1} ${R(midY)} L ${x2} ${R(midY)} L ${x2} ${y2}`;
    } else if (x2 > x1 + spacing) {
      // Target to the right: go right and down/up
      const midX = x1 + spacing;
      return `M ${x1} ${y1} L ${R(midX)} ${y1} L ${R(midX)} ${y2} L ${x2} ${y2}`;
    } else if (x2 < x1 - spacing) {
      // Target to the left: go left then down/up to target
      const midX = x1 - spacing;
      return `M ${x1} ${y1} L ${R(midX)} ${y1} L ${R(midX)} ${y2} L ${x2} ${y2}`;
    } else {
      // Default: straight down/up then across
      const midY = y1 + (y2 - y1) / 2;
      return `M ${x1} ${y1} L ${x1} ${R(midY)} L ${x2} ${R(midY)} L ${x2} ${y2}`;
    }
  };

  // Loop-back specifically: clean left-side wrap around
  const getLoopBackPath = (x1, y1, x2, y2) => {
    x1 = R(x1); y1 = R(y1); x2 = R(x2); y2 = R(y2);
    const laneX = R(Math.min(x1, x2) - 120);
    const downY = R(y1 + 34);
    return `M ${x1} ${y1} L ${x1} ${downY} L ${laneX} ${downY} L ${laneX} ${y2} L ${x2} ${y2}`;
  };

  // FALSE branch skip-around path
  const getIfFalsePath = (x1, y1, x2, y2) => {
    x1 = R(x1); y1 = R(y1); x2 = R(x2); y2 = R(y2);
    if (y2 <= y1 + 10) return getOrthogonalPath(x1, y1, x2, y2);
    const laneX = R(Math.max(x1, x2) + 44);
    const joinY = R(Math.max(y1 + 22, y2 - 24));
    return `M ${x1} ${y1} L ${laneX} ${y1} L ${laneX} ${joinY} L ${x2} ${joinY} L ${x2} ${y2}`;
  };

  // After Last horizontal-first path
  const getAfterLastPath = (x1, y1, x2, y2) => {
    x1 = R(x1); y1 = R(y1); x2 = R(x2); y2 = R(y2);
    if (x2 <= x1 + 30) return getOrthogonalPath(x1, y1, x2, y2);
    if (Math.abs(y2 - y1) <= 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
    const elbowX = R(x2 - 28);
    return `M ${x1} ${y1} L ${elbowX} ${y1} L ${elbowX} ${y2} L ${x2} ${y2}`;
  };

  // Decision branch: create a clear top rail, then drop to each target edge.
  const getDecisionBranchPath = (x1, y1, x2, y2) => {
    x1 = R(x1); y1 = R(y1); x2 = R(x2); y2 = R(y2);
    const railY = R(y1 + 28);
    if (y2 <= railY + 6) return getOrthogonalPath(x1, y1, x2, y2);
    return `M ${x1} ${y1} L ${x1} ${railY} L ${x2} ${railY} L ${x2} ${y2}`;
  };

  const [hoveredConn, setHoveredConn] = useState(null);

  // Detect loop bodies: nodes reachable from for_each outputs
  const getLoopBodies = () => {
    const loopNodes = nodes.filter(n => n.templateId === "for_loop");
    const loopBodies = [];

    loopNodes.forEach(loop => {
      const forEachConns = connections.filter(c => c.fromId === loop.id && c.output === "for_each");
      const bodyNodes = new Set();
      const visited = new Set();

      const traverse = (nodeId) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        bodyNodes.add(nodeId);

        const nexts = connections.filter(c => c.fromId === nodeId && c.output !== "false");
        nexts.forEach(conn => {
          const afterLastConns = connections.filter(c => c.fromId === loop.id && c.output === "after_last");
          const isExitNode = afterLastConns.some(ac => ac.toId === conn.toId);

          if (!isExitNode && conn.toId !== loop.id) {
            traverse(conn.toId);
          }
        });
      };

      forEachConns.forEach(c => traverse(c.toId));
      loopBodies.push({ loopId: loop.id, bodyNodeIds: Array.from(bodyNodes), loopNode: loop });
    });

    return loopBodies;
  };

  const loopBodies = getLoopBodies();

  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 5 }}>
      <defs>
        <marker id="ch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M2 1.5L8 5L2 8.5" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id="ch-arrow-hover" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M2 1.5L8 5L2 8.5" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id="ch-arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M2 1.5L8 5L2 8.5" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id="ch-arrow-iterate" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M2 1.5L8 5L2 8.5" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {/* Visual iteration loop indicators for loop bodies without manual connection */}
      {loopBodies.map(body => {
        const loopNode = body.loopNode;
        const bodyNodeIds = new Set(body.bodyNodeIds);

        // Find deepest/last action nodes in loop body
        const exitPoints = body.bodyNodeIds
          .map(nodeId => {
            const node = nodes.find(n => n.id === nodeId);
            const hasOutgoingInBody = connections.some(c => c.fromId === nodeId && bodyNodeIds.has(c.toId));
            return !hasOutgoingInBody ? node : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.y - a.y);

        if (exitPoints.length === 0) return null;

        const exitNode = exitPoints[0];
        const hasExplicitLoopBack = connections.some(
          c => exitNode.id === c.fromId && loopNode.id === c.toId
        );

        if (hasExplicitLoopBack) return null;

        const exitNodeAnchors = getNodeAnchors(exitNode.id);
        const loopNodeAnchors = getNodeAnchors(loopNode.id);
        const from = exitNodeAnchors.bottom;
        const to = loopNodeAnchors.top;
        const sideX = Math.min(from.x, to.x) - 140;
        const path = `M ${from.x} ${from.y} L ${from.x} ${from.y + 40} L ${sideX} ${from.y + 40} L ${sideX} ${to.y} L ${to.x} ${to.y}`;

        return (
          <g key={`loop-hint-${body.loopId}`} style={{ pointerEvents: "none", opacity: 0.7 }}>
            <path d={path} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" markerEnd="url(#ch-arrow-iterate)" />
            <text x={sideX - 20} y={from.y + 25} style={{ fontSize: 10, fill: "#f59e0b", fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
              Iterate
            </text>
          </g>
        );
      })}

      {connections.map(conn => {
        const { from, to, isIterationLoopBack } = getConnectionPoints(conn);
        if (!from || !to) return null;
        const fromNode = nodes.find(n => n.id === conn.fromId);
        const isLoopBack = !!conn.meta?.autoLoopBack || !!isIterationLoopBack;
        const isDecisionBranch = fromNode?.templateId === "if_condition";

        const isAfterLast = fromNode?.templateId === "for_loop" && conn.output === "after_last";
        const isIfFalse = fromNode?.templateId === "nested_if" && conn.output === "false";
        const path = isLoopBack
          ? getLoopBackPath(from.x, from.y, to.x, to.y)
          : isDecisionBranch
            ? getDecisionBranchPath(from.x, from.y, to.x, to.y)
            : isIfFalse
              ? getIfFalsePath(from.x, from.y, to.x, to.y)
              : isAfterLast
                ? getAfterLastPath(from.x, from.y, to.x, to.y)
                : getOrthogonalPath(from.x, from.y, to.x, to.y);
        const isHov = hoveredConn === conn.id;
        let lbl = formatOutputLabel(conn.output);
        const def = fromNode ? TEMPLATE_DEFS[fromNode.templateId] : null;
        if (!isLoopBack && def && typeof def.outputLabels === 'function') {
          lbl = def.outputLabels(fromNode.config)[conn.output] || lbl;
        }
        const outputLabel = isLoopBack ? "Iterate" : lbl;
        const labelBg = isLoopBack ? "#fed7aa" : isHov ? "#fee2e2" : "#eef2ff";
        const labelStroke = isLoopBack ? "#fb923c" : isHov ? "#fca5a5" : "#c7d2fe";
        const labelColor = isLoopBack ? "#b45309" : isHov ? "#dc2626" : "#6366f1";
        const labelWidth = Math.max(40, outputLabel.length * 6 + 16);
        const railY = R(from.y + 28);
        const labelX = isDecisionBranch ? R(to.x) : R((from.x + to.x) / 2);
        const labelY = isDecisionBranch ? railY : R((from.y + to.y) / 2 - 8);
        const plusX = isDecisionBranch ? R(to.x) : labelX;
        const plusY = isDecisionBranch ? R(railY - 18) : R(from.y + 28);

        return (
          <g key={conn.id}>
            <g
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onMouseEnter={() => setHoveredConn(conn.id)}
              onMouseLeave={() => setHoveredConn(null)}
              onClick={() => onDeleteConnection(conn.id)}
            >
              {/* Invisible wide hit area */}
              <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
              {/* Visible line */}
              <path d={path}
                fill="none"
                stroke={isHov ? "#dc2626" : isLoopBack ? "#6b7280" : "#6366f1"}
                strokeWidth={2}
                markerEnd={isHov ? "url(#ch-arrow-hover)" : isLoopBack ? "url(#ch-arrow-gray)" : "url(#ch-arrow)"}
                style={{ transition: "stroke 0.15s" }}
              />
              {/* Connection label */}
              {conn.output && (
                <g>
                  <rect x={labelX - labelWidth / 2} y={labelY - 8} width={labelWidth} height={16} rx={8} fill={labelBg} stroke={labelStroke} strokeWidth={1} />
                  <text x={labelX} y={labelY + 3} textAnchor="middle" style={{ fontSize: 9, fill: labelColor, fontWeight: 600, userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
                    {outputLabel}
                  </text>
                </g>
              )}
              {/* Delete hint on hover */}
              {isHov && (
                <text x={labelX} y={labelY + 18} textAnchor="middle" style={{ fontSize: 9, fill: "#dc2626", fontWeight: 500, userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
                  click to remove
                </text>
              )}
            </g>

            {/* Decision inline insert control on the branch, matching Salesforce placement */}
            {isDecisionBranch && onInlineAddClick && (
              <g
                style={{ pointerEvents: "all", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onInlineAddClick(conn.fromId, conn.output, { graphX: plusX, graphY: plusY });
                }}
              >
                <circle cx={plusX} cy={plusY} r={10} fill="#fff" stroke="#6b7280" strokeWidth={1.25} />
                <path d={`M ${plusX - 4} ${plusY} L ${plusX + 4} ${plusY} M ${plusX} ${plusY - 4} L ${plusX} ${plusY + 4}`} stroke="#2563eb" strokeWidth={1.5} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}
      {/* Live connection line while dragging */}
      {connectingFrom && mousePos && (() => {
        const from = getNodeBottom(connectingFrom);
        if (!from) return null;
        const path = getOrthogonalPath(from.x, from.y, mousePos.x, mousePos.y);
        return (
          <path d={path}
            fill="none" stroke="#9ca3af" strokeWidth={2} strokeDasharray="6 4"
            markerEnd="url(#ch-arrow-gray)"
            style={{ transition: "none" }}
          />
        );
      })()}
    </svg>
  );
}


// ─── JSON Export Modal ────────────────────────────────────────────────────────


function ExportModal({ nodes, connections, onClose }) {
  const flow = {
    version: "1.0",
    nodes: nodes.map(n => ({
      id: n.id,
      templateId: n.templateId,
      position: { x: n.x, y: n.y },
      config: n.config,
    })),
    connections: connections.map(c => ({
      id: c.id,
      from: c.fromId,
      output: c.output,
      to: c.toId,
    })),
  };
  const json = JSON.stringify(flow, null, 2);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, width: 540, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Export Flow JSON</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>
        <pre style={{ padding: 18, fontSize: 11, overflowY: "auto", margin: 0, background: "#1e1e2e", color: "#cdd6f4", borderRadius: "0 0 12px 12px", lineHeight: 1.6 }}>
          {json}
        </pre>
        <div style={{ padding: "10px 18px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 8 }}>
          <button onClick={() => navigator.clipboard?.writeText(json)}
            style={{ padding: "7px 14px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
            Copy to clipboard
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Resource Modal ────────────────────────────────────────────────────────────

function ResourceModal({ onClose, onSave }) {
  const [type, setType] = useState("Variable");
  const [apiName, setApiName] = useState("");
  const [description, setDescription] = useState("");
  const [dataType, setDataType] = useState("Text");
  const [value, setValue] = useState("");
  const [expression, setExpression] = useState("");

  const save = () => {
    if (!apiName) return;
    const resource = {
      id: uid(),
      type,
      apiName,
      description,
      ...(type === "Variable" ? { dataType, defaultValue: value } : {}),
      ...(type === "Constant" ? { dataType, value } : {}),
      ...(type === "Formula" ? { dataType, expression } : {}),
      ...(type === "Text Template" ? { expression } : {}),
    };
    onSave(resource);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, width: 480, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>New Resource</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Resource Type *</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}>
              <option>Variable</option>
              <option>Constant</option>
              <option>Formula</option>
              <option>Text Template</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>API Name *</label>
            <input value={apiName} onChange={e => setApiName(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", resize: "vertical" }} />
          </div>

          {(type === "Variable" || type === "Constant" || type === "Formula") && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Data Type</label>
              <select value={dataType} onChange={e => setDataType(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}>
                <option>Text</option>
                <option>Number</option>
                <option>Boolean</option>
                <option>Date</option>
                <option>Record</option>
              </select>
            </div>
          )}

          {(type === "Variable" || type === "Constant") && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{type === "Variable" ? "Default Value" : "Value"}</label>
              <input value={value} onChange={e => setValue(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
            </div>
          )}

          {(type === "Formula" || type === "Text Template") && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{type === "Formula" ? "Formula Expression" : "Text Template"}</label>
              <textarea value={expression} onChange={e => setExpression(e.target.value)} rows={4} style={{ width: "100%", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", resize: "vertical", fontFamily: type === "Formula" ? "monospace" : "inherit" }} />
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "7px 16px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={!apiName} style={{ padding: "7px 16px", fontSize: 13, border: "none", borderRadius: 6, background: apiName ? "#1d4ed8" : "#9ca3af", color: "#fff", cursor: apiName ? "pointer" : "default", fontWeight: 600 }}>Done</button>
        </div>
      </div>
    </div>
  );
}


// ─── Minimap ───────────────────────────────────────────────────────────────────

function Minimap({ nodes, viewportRect }) {
  const MINIMAP_W = 160;
  const MINIMAP_H = 100;

  if (nodes.length === 0) return null;

  // Compute bounds of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.y + 140);
  });
  const padding = 100;
  minX -= padding; minY -= padding; maxX += padding; maxY += padding;
  const worldW = Math.max(maxX - minX, 400);
  const worldH = Math.max(maxY - minY, 300);
  const scaleX = MINIMAP_W / worldW;
  const scaleY = MINIMAP_H / worldH;
  const s = Math.min(scaleX, scaleY);

  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16, width: MINIMAP_W, height: MINIMAP_H,
      background: "rgba(255,255,255,0.92)", border: "1px solid #e5e7eb", borderRadius: 8,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)", zIndex: 50, overflow: "hidden",
    }}>
      {nodes.map(n => {
        const def = TEMPLATE_DEFS[n.templateId];
        return (
          <div key={n.id} style={{
            position: "absolute",
            left: (n.x - minX) * s,
            top: (n.y - minY) * s,
            width: NODE_WIDTH * s,
            height: 20 * s,
            background: def.color,
            borderRadius: 2,
            opacity: 0.7,
          }} />
        );
      })}
      {/* Viewport indicator */}
      {viewportRect && (
        <div style={{
          position: "absolute",
          left: (viewportRect.x - minX) * s,
          top: (viewportRect.y - minY) * s,
          width: viewportRect.w * s,
          height: viewportRect.h * s,
          border: "1.5px solid #2563eb",
          borderRadius: 2,
          background: "rgba(37,99,235,0.06)",
        }} />
      )}
    </div>
  );
}


// ─── Main Component ────────────────────────────────────────────────────────────


export default function FlowAutomationPage() {
  // Load draft flow from localStorage
  const [nodes, setNodes] = useState(() => {
    try {
      const draft = localStorage.getItem("flow_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        return parsed.nodes || [];
      }
    } catch (e) {
      console.warn("Failed to load draft flow:", e);
    }
    return [];
  });

  const [connections, setConnections] = useState(() => {
    try {
      const draft = localStorage.getItem("flow_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        return parsed.connections || [];
      }
    } catch (e) {
      console.warn("Failed to load draft flow:", e);
    }
    return [];
  });

  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [toast, setToast] = useState(null);

  const [flowName, setFlowName] = useState(() => {
    try {
      const draft = localStorage.getItem("flow_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        return parsed.name || "My Automation Flow";
      }
    } catch (e) {
      console.warn("Failed to load draft flow name:", e);
    }
    return "My Automation Flow";
  });
  const canvasRef = useRef(null);
  const canvasInnerRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState(null);

  // Sidebar tabs
  const [isElementsSidebarOpen, setIsElementsSidebarOpen] = useState(window.innerWidth >= 768);
  const [activeSidebarTab, setActiveSidebarTab] = useState("elements");
  const [resources, setResources] = useState(() => {
    try {
      const stored = localStorage.getItem("flow_resources");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showResourceModal, setShowResourceModal] = useState(false);

  // Canvas pan & zoom
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const [inlineAddMenu, setInlineAddMenu] = useState(null); // { sourceNodeId, output, targetNodeId, x, y, graphX, graphY }

  const handleInlineAddClick = useCallback((sourceNodeId, output, payload) => {
    if (payload && typeof payload.stopPropagation === "function") {
      payload.stopPropagation();
    }
    const conn = connections.find(c => c.fromId === sourceNodeId && c.output === output) || null;
    const rect = (canvasInnerRef.current || canvasRef.current)?.getBoundingClientRect();
    const hasGraphPoint = payload && typeof payload.graphX === "number" && typeof payload.graphY === "number";
    const graphX = hasGraphPoint ? payload.graphX : (rect && payload ? (payload.clientX - rect.left) / scale : null);
    const graphY = hasGraphPoint ? payload.graphY : (rect && payload ? (payload.clientY - rect.top) / scale : null);
    const clientX = hasGraphPoint ? ((rect ? rect.left : 0) + payload.graphX * scale) : (payload?.clientX ?? 0);
    const clientY = hasGraphPoint ? ((rect ? rect.top : 0) + payload.graphY * scale) : (payload?.clientY ?? 0);

    setInlineAddMenu({
      sourceNodeId,
      output,
      targetNodeId: conn ? conn.toId : null,
      x: clientX,
      y: clientY,
      graphX,
      graphY,
    });
  }, [connections, scale]);

  const insertInlineNode = useCallback((templateId) => {
    if (!inlineAddMenu) return;
    const { sourceNodeId, output, targetNodeId, graphX, graphY } = inlineAddMenu;
    const def = TEMPLATE_DEFS[templateId];
    const newNodeId = uid();

    const sourceNode = nodes.find(n => n.id === sourceNodeId) || null;
    const targetNode = targetNodeId ? nodes.find(n => n.id === targetNodeId) || null : null;
    const outputList = (typeof def.outputs === "function" ? def.outputs(def.defaultConfig) : def.outputs) || [];
    const hasTarget = !!targetNode;
    const primaryOutput = outputList[0] || null;
    const isInsertedDecision = templateId === "if_condition";

    const fallbackX = sourceNode ? sourceNode.x : 200;
    const computedX = typeof graphX === "number"
      ? graphX - NODE_WIDTH / 2
      : sourceNode && targetNode
        ? sourceNode.x + (targetNode.x - sourceNode.x) / 2
        : fallbackX;

    const sourceBottom = sourceNode ? sourceNode.y + NODE_HEIGHT : 220;
    const fallbackY = sourceNode ? sourceNode.y + 180 : 200;
    const computedY = sourceNode && targetNode && targetNode.y > sourceBottom + 40
      ? sourceBottom + (targetNode.y - sourceBottom) / 2 - NODE_HEIGHT / 2
      : typeof graphY === "number"
        ? Math.max(sourceBottom + 20, graphY - NODE_HEIGHT / 2)
        : fallbackY;

    const newX = snapToGrid(Math.max(40, computedX));
    const newY = snapToGrid(Math.max(60, computedY));

    const newNode = {
      id: newNodeId,
      templateId,
      x: newX,
      y: newY,
      config: deepClone(def.defaultConfig),
    };

    const outputsNeedingAutoEnd = isInsertedDecision
      ? (hasTarget && primaryOutput ? outputList.slice(1) : outputList)
      : [];

    const branchSpacing = 220;
    const branchStartX = newX - ((outputsNeedingAutoEnd.length - 1) * branchSpacing) / 2;
    const autoEndNodes = outputsNeedingAutoEnd.map((out, idx) => ({
      id: uid(),
      templateId: "end",
      x: snapToGrid(branchStartX + idx * branchSpacing),
      y: snapToGrid(newY + 220),
      config: {},
      meta: { autoCreatedFor: newNodeId, autoCreatedOutput: out },
    }));

    const pushedTargetY = targetNode
      ? snapToGrid(Math.max(targetNode.y, newY + (isInsertedDecision ? 230 : 190)))
      : null;

    setNodes(prev => {
      const updated = prev.map(n =>
        n.id === targetNodeId && pushedTargetY !== null
          ? { ...n, y: pushedTargetY }
          : n
      );
      return [...updated, newNode, ...autoEndNodes];
    });

    setConnections(prev => {
      const existingConn = prev.find(c => c.fromId === sourceNodeId && c.output === output) || null;
      let next = prev.filter(c => !(c.fromId === sourceNodeId && c.output === output));

      next.push({
        id: uid(),
        fromId: sourceNodeId,
        output,
        toId: newNodeId,
        meta: {
          ...(existingConn?.meta || {}),
          toSide: "top",
        },
      });

      if (hasTarget && primaryOutput) {
        next.push({
          id: uid(),
          fromId: newNodeId,
          output: primaryOutput,
          toId: targetNodeId,
          meta: {
            fromSide: isInsertedDecision && primaryOutput === "false" ? "right" : "bottom",
            toSide: existingConn?.meta?.toSide || "top",
          },
        });
      }

      autoEndNodes.forEach((endNode, idx) => {
        const branchOutput = outputsNeedingAutoEnd[idx];
        next.push({
          id: uid(),
          fromId: newNodeId,
          output: branchOutput,
          toId: endNode.id,
          meta: {
            fromSide: isInsertedDecision && branchOutput === "false" ? "right" : "bottom",
            toSide: "top",
          },
        });
      });

      return next;
    });

    setInlineAddMenu(null);
  }, [inlineAddMenu, nodes]);

  // Refs for connection state (avoids stale closures)
  const connectingFromRef = useRef(null);
  const connectingOutputRef = useRef(null);

  // Viewport rect for minimap
  const [viewportRect, setViewportRect] = useState(null);

  // Persist resources to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("flow_resources", JSON.stringify(resources));
    } catch (e) {
      console.warn("Failed to save resources to localStorage:", e);
    }
  }, [resources]);

  // Auto-save draft flow to localStorage
  useEffect(() => {
    try {
      const draft = {
        name: flowName,
        nodes: nodes,
        connections: connections,
      };
      localStorage.setItem("flow_draft", JSON.stringify(draft));
    } catch (e) {
      console.warn("Failed to save draft flow to localStorage:", e);
    }
  }, [nodes, connections, flowName]);

  // Update viewport rect
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setViewportRect({
        x: -panOffset.x / scale,
        y: -panOffset.y / scale,
        w: rect.width / scale,
        h: rect.height / scale,
      });
    };
    update();
  }, [panOffset, scale]);


  // ─── Keep connections valid when nodes change ─────────────

  useEffect(() => {
    setConnections(prev => {
      const nodeIds = new Set(nodes.map(n => n.id));
      let next = prev.filter(c => nodeIds.has(c.fromId) && nodeIds.has(c.toId));
      let changed = next.length !== prev.length;

      const nestedIfIds = new Set(
        nodes.filter(n => n.templateId === "nested_if").map(n => n.id)
      );

      const childrenByParent = new Map();
      nodes.forEach(n => {
        const parentId = n.meta?.autoInnerFor;
        if (!parentId) return;
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
        childrenByParent.get(parentId).push(n);
      });

      // Remove stale auto-inner connections for deleted/invalid parents.
      const validAuto = next.filter(c => {
        if (!c.meta?.autoInnerFor) return true;
        return nestedIfIds.has(c.meta.autoInnerFor) && childrenByParent.has(c.meta.autoInnerFor);
      });
      if (validAuto.length !== next.length) changed = true;
      next = validAuto;

      // Rebuild deterministic auto chain for each nested_if parent.
      for (const [parentId, children] of childrenByParent.entries()) {
        if (!nestedIfIds.has(parentId)) continue;

        const ordered = [...children].sort(
          (a, b) => (a.meta?.autoInnerIndex || 0) - (b.meta?.autoInnerIndex || 0)
        );

        // Clear previous chain and any conflicting true output from parent.
        const pruned = next.filter(
          c => c.meta?.autoInnerFor !== parentId && !(c.fromId === parentId && c.output === "true")
        );
        if (pruned.length !== next.length) changed = true;
        next = pruned;

        if (ordered.length === 0) continue;

        next.push({
          id: uid(),
          fromId: parentId,
          output: "true",
          toId: ordered[0].id,
          meta: { autoInnerFor: parentId },
        });
        changed = true;

        for (let i = 0; i < ordered.length - 1; i += 1) {
          next.push({
            id: uid(),
            fromId: ordered[i].id,
            output: "true",
            toId: ordered[i + 1].id,
            meta: { autoInnerFor: parentId },
          });
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [nodes]);


  // ─── Zoom with scroll wheel ────────────────────────────────

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        // Pinch zoom
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        setScale(prev => {
          const next = Math.min(2.5, Math.max(0.2, prev * delta));
          // Zoom toward cursor
          const ratio = next / prev;
          setPanOffset(po => ({
            x: mx - ratio * (mx - po.x),
            y: my - ratio * (my - po.y),
          }));
          return next;
        });
      } else {
        // Pan with scroll
        setPanOffset(po => ({
          x: po.x - e.deltaX,
          y: po.y - e.deltaY,
        }));
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);


  // ─── Node CRUD ─────────────────────────────────────────────

  const addNodeAt = useCallback((templateId, x, y) => {
    const def = TEMPLATE_DEFS[templateId];
    const newNodeId = uid();
    const newNode = {
      id: newNodeId,
      templateId,
      x: snapToGrid(x),
      y: snapToGrid(y),
      config: deepClone(def.defaultConfig),
    };

    const addedNodes = [newNode];
    const addedConns = [];

    if (templateId === "if_condition" && def.outputs) {
      const ports = typeof def.outputs === 'function' ? def.outputs(newNode.config) : def.outputs;
      const totalWidth = (ports.length - 1) * 200;
      const startX = newNode.x - (totalWidth / 2);

      ports.forEach((port, idx) => {
        const endId = uid();
        addedNodes.push({
          id: endId,
          templateId: "end",
          x: snapToGrid(startX + (idx * 200)),
          y: snapToGrid(newNode.y + 160),
          config: {},
        });
        addedConns.push({
          id: uid(),
          fromId: newNodeId,
          output: port,
          toId: endId,
        });
      });
    }

    setNodes(prev => [...prev, ...addedNodes]);
    if (addedConns.length > 0) {
      setConnections(prev => [...prev, ...addedConns]);
    }
  }, []);

  const addNode = useCallback((templateId) => {
    // When clicking sidebar, place in center of viewport
    const el = canvasRef.current;
    if (!el) return addNodeAt(templateId, 200, 200);
    const rect = el.getBoundingClientRect();
    const cx = (rect.width / 2 - panOffset.x) / scale - NODE_WIDTH / 2;
    const cy = (rect.height / 2 - panOffset.y) / scale - 60;
    addNodeAt(templateId, cx + Math.random() * 60 - 30, cy + Math.random() * 60 - 30);

    // Auto-close elements panel on mobile after adding an element
    if (window.innerWidth < 768) {
      setIsElementsSidebarOpen(false);
    }
  }, [addNodeAt, panOffset, scale]);

  const updateNodePosition = useCallback((id, x, y) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  }, []);

  const updateNodeConfig = useCallback((id, config) => {
    setNodes(prev => {
      const targetNode = prev.find(n => n.id === id);
      if (!targetNode) return prev;

      if (targetNode.templateId === "if_condition") {
        const def = TEMPLATE_DEFS["if_condition"];
        const oldOutputs = def.outputs(targetNode.config);
        const newOutputs = def.outputs(config);

        const parentNode = { ...targetNode, config };
        const addedOutputs = newOutputs.filter(o => !oldOutputs.includes(o));

        if (addedOutputs.length === 0) {
          return prev.map(n => n.id === id ? parentNode : n);
        }

        const newEndNodes = addedOutputs.map((out, idx) => ({
          id: uid(),
          templateId: "end",
          x: snapToGrid(parentNode.x + ((oldOutputs.length + idx) * 200) - ((newOutputs.length - 1) * 100)),
          y: snapToGrid(parentNode.y + 160),
          config: {}
        }));

        setConnections(prevConns => {
          const newConns = addedOutputs.map((out, idx) => ({
            id: uid(),
            fromId: id,
            output: out,
            toId: newEndNodes[idx].id,
          }));
          return [...prevConns, ...newConns];
        });

        return prev.map(n => n.id === id ? parentNode : n).concat(newEndNodes);
      }

      if (targetNode.templateId !== "nested_if") {
        return prev.map(n => (n.id === id ? { ...n, config } : n));
      }

      const oldAutoInnerNodes = prev.filter(n => n.meta?.autoInnerFor === id);
      const oldAutoInnerIds = new Set(oldAutoInnerNodes.map(n => n.id));

      const safeInnerConditions = Array.isArray(config.innerConditions)
        ? config.innerConditions.filter(inner => inner && inner.field)
        : [];

      const parentNode = { ...targetNode, config };
      const generatedInnerNodes = safeInnerConditions.map((innerCfg, index) => ({
        id: uid(),
        templateId: "if_condition",
        x: snapToGrid(parentNode.x),
        y: snapToGrid(parentNode.y + 180 + index * 180),
        config: {
          field: innerCfg.field || "score",
          operator: innerCfg.operator || ">",
          value: innerCfg.value || "",
          trueLabel: innerCfg.trueLabel || "Yes",
          falseLabel: innerCfg.falseLabel || "No",
        },
        meta: {
          autoInnerFor: id,
          autoInnerIndex: index,
        },
      }));

      const nextNodes = prev
        .filter(n => n.id !== id && !oldAutoInnerIds.has(n.id))
        .concat(parentNode, generatedInnerNodes);

      setConnections(prevConnections => {
        let nextConnections = prevConnections.filter(
          c => !oldAutoInnerIds.has(c.fromId) && !oldAutoInnerIds.has(c.toId)
        );

        // Keep nested_if true branch single-source: remove any existing true links
        // (manual or auto) before rebuilding the auto inner-if chain.
        nextConnections = nextConnections.filter(
          c => c.meta?.autoInnerFor !== id && !(c.fromId === id && c.output === "true")
        );

        if (generatedInnerNodes.length > 0) {
          nextConnections.push({
            id: uid(),
            fromId: id,
            output: "true",
            toId: generatedInnerNodes[0].id,
            meta: { autoInnerFor: id },
          });

          for (let i = 0; i < generatedInnerNodes.length - 1; i += 1) {
            nextConnections.push({
              id: uid(),
              fromId: generatedInnerNodes[i].id,
              output: "true",
              toId: generatedInnerNodes[i + 1].id,
              meta: { autoInnerFor: id },
            });
          }
        }

        return nextConnections;
      });

      return nextNodes;
    });
  }, []);

  const deleteNode = useCallback((id) => {
    setNodes(prev => {
      const autoChildIds = new Set(
        prev.filter(n => n.meta?.autoInnerFor === id).map(n => n.id)
      );
      return prev.filter(n => n.id !== id && !autoChildIds.has(n.id));
    });
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id && c.meta?.autoInnerFor !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);


  // ─── Connections ───────────────────────────────────────────

  const handleConnectStart = useCallback((nodeId, output) => {
    connectingFromRef.current = nodeId;
    connectingOutputRef.current = output;
    setConnectingFrom(nodeId);
  }, []);

  const cancelConnect = useCallback(() => {
    connectingFromRef.current = null;
    connectingOutputRef.current = null;
    setConnectingFrom(null);
    setMousePos(null);
  }, []);

  const handleConnectEnd = useCallback((toId, toSide = "top") => {
    const fromId = connectingFromRef.current;
    const output = connectingOutputRef.current;
    if (fromId && toId && toId !== fromId) {
      setConnections(prev => {
        const fromNode = nodes.find(n => n.id === fromId);
        const toNode = nodes.find(n => n.id === toId);

        const resolvedFromSide = (() => {
          if (!fromNode) return "bottom";
          if (fromNode.templateId === "for_loop") return output === "after_last" ? "right" : "bottom";
          if (fromNode.templateId === "if_condition" || fromNode.templateId === "nested_if") return output === "false" ? "right" : "bottom";
          return "bottom";
        })();
        const resolvedToSide = toSide || "top";
        const isIterationLoopBack = toNode?.templateId === "for_loop" && resolvedFromSide === "bottom" && fromNode && fromNode.y > toNode.y;
        const isAfterLastBranch = fromNode?.templateId === "for_loop" && output === "after_last";
        const finalToSide = isIterationLoopBack
          ? "top"
          : isAfterLastBranch
            ? "left"
            : resolvedToSide;

        // Prevent duplicate connections for standard links.
        const exists = prev.some(c =>
          c.fromId === fromId &&
          c.output === output &&
          c.toId === toId &&
          (c.meta?.fromSide || "bottom") === resolvedFromSide &&
          (c.meta?.toSide || "top") === finalToSide
        );
        if (exists) return prev;

        return [
          ...prev,
          {
            id: uid(),
            fromId,
            output,
            toId,
            meta: {
              fromSide: resolvedFromSide,
              toSide: finalToSide,
              ...(isIterationLoopBack ? { loopKind: "iteration" } : {}),
            },
          }
        ];
      });
    }
    cancelConnect();
  }, [cancelConnect, nodes]);


  // ─── Canvas mouse handlers ─────────────────────────────────

  const handleCanvasMouseMove = useCallback((e) => {
    // Connection line tracking
    if (connectingFromRef.current && canvasInnerRef.current) {
      const rect = canvasInnerRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      });
    }

    // Canvas panning
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPanOffset({
        x: panStart.current.ox + dx,
        y: panStart.current.oy + dy,
      });
    }
  }, [scale]);

  const handleCanvasMouseDown = useCallback((e) => {
    // Cancel connection on bare canvas click
    if (connectingFromRef.current) {
      if (e.target === canvasInnerRef.current || e.target === canvasRef.current || e.target.tagName === "rect" || e.target.tagName === "circle") {
        cancelConnect();
      }
      return;
    }

    // Start panning on middle-click or right-click, or on the canvas background with left click
    const isBackground = e.target === canvasInnerRef.current || e.target === canvasRef.current || e.target.tagName === "rect" || e.target.tagName === "circle";
    if (isBackground && e.button === 0) {
      // Deselect + start pan
      setSelectedId(null);
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
      e.preventDefault();
    }
  }, [cancelConnect, panOffset]);

  const handleCanvasMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);


  // ─── Drag-and-Drop from Sidebar ────────────────────────────

  const handleSidebarDragStart = useCallback((e, templateId) => {
    e.dataTransfer.setData("application/flow-template", templateId);
    e.dataTransfer.effectAllowed = "copy";
    // Create custom drag image
    const el = e.currentTarget.cloneNode(true);
    el.style.width = "180px";
    el.style.opacity = "0.8";
    el.style.position = "absolute";
    el.style.top = "-1000px";
    document.body.appendChild(el);
    e.dataTransfer.setDragImage(el, 90, 20);
    setTimeout(() => document.body.removeChild(el), 0);
  }, []);

  const handleCanvasDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    const templateId = e.dataTransfer.getData("application/flow-template");
    if (!templateId || !TEMPLATE_DEFS[templateId]) return;

    const rect = canvasInnerRef.current
      ? canvasInnerRef.current.getBoundingClientRect()
      : canvasRef.current.getBoundingClientRect();

    const x = (e.clientX - rect.left) / scale - NODE_WIDTH / 2;
    const y = (e.clientY - rect.top) / scale - 30;
    addNodeAt(templateId, x, y);
  }, [addNodeAt, scale]);


  const deleteConnection = useCallback((id) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  const saveFlow = useCallback(() => {
    if (nodes.length === 0) {
      setToast({ msg: "Cannot save an empty flow. Add at least one node.", type: 'error' });
      return;
    }
    try {
      const flow = {
        version: "1.0",
        name: flowName,
        timestamp: new Date().toISOString(),
        nodes: nodes.map(n => ({
          id: n.id,
          templateId: n.templateId,
          position: { x: n.x, y: n.y },
          config: n.config,
        })),
        connections: connections.map(c => ({
          id: c.id,
          from: c.fromId,
          output: c.output,
          to: c.toId,
        })),
      };

      // Save to localStorage with timestamp as unique key
      const flowKey = `flow_${flowName.replace(/\s+/g, "_")}_${Date.now()}`;
      localStorage.setItem(flowKey, JSON.stringify(flow));

      // Also maintain a list of saved flows
      try {
        const savedFlows = JSON.parse(localStorage.getItem("saved_flows") || "[]");
        savedFlows.push({
          key: flowKey,
          name: flowName,
          nodeCount: nodes.length,
          connectionCount: connections.length,
          savedAt: new Date().toISOString(),
        });
        localStorage.setItem("saved_flows", JSON.stringify(savedFlows));
      } catch (e) {
        console.warn("Failed to update saved flows list:", e);
      }

      setToast({ msg: `Flow "${flowName}" saved successfully!`, type: 'success' });
    } catch (e) {
      console.error("Failed to save flow:", e);
      setToast({ msg: "Failed to save flow. Please try again.", type: 'error' });
    }
  }, [nodes, connections, flowName]);

  const editingNode = editingId ? nodes.find(n => n.id === editingId) : null;

  const filteredTemplates = Object.values(TEMPLATE_DEFS).filter(t =>
    !activeCategory || t.category === activeCategory
  );


  // ─── Zoom controls ────────────────────────────────────────

  const zoomIn = () => {
    setScale(s => Math.min(2.5, s * 1.2));
  };
  const zoomOut = () => {
    setScale(s => Math.max(0.2, s * 0.83));
  };
  const zoomFit = () => {
    if (nodes.length === 0) { setScale(1); setPanOffset({ x: 40, y: 40 }); return; }
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + NODE_WIDTH);
      maxY = Math.max(maxY, n.y + 140);
    });
    const padding = 80;
    const worldW = maxX - minX + padding * 2;
    const worldH = maxY - minY + padding * 2;
    const newScale = Math.min(1.5, Math.min(rect.width / worldW, rect.height / worldH));
    setScale(newScale);
    setPanOffset({
      x: (rect.width - worldW * newScale) / 2 - (minX - padding) * newScale,
      y: (rect.height - worldH * newScale) / 2 - (minY - padding) * newScale,
    });
  };


  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "radial-gradient(circle at 16% 14%, #eef7ff 0%, #f7fbff 38%, #f8fafc 78%)",
      fontFamily: "'Plus Jakarta Sans', 'Avenir Next', 'Segoe UI', sans-serif"
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes dropGlow { 0%{box-shadow: 0 0 0 0 rgba(37,99,235,0.3)} 100%{box-shadow: 0 0 0 12px rgba(37,99,235,0)} }
        @keyframes menuIn { 0% { opacity: 0; transform: translateY(-4px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .sidebar-item:hover { transform: translateX(2px); }
        .sidebar-item:active { transform: scale(0.97); }
        .zoom-btn:hover { background: #f1f5f9 !important; }
        * { box-sizing: border-box; }
        @media (max-width: 767.98px) {
          .crm-flow-sidebar {
            position: absolute !important;
            left: 0;
            top: 52px;
            height: calc(100vh - 52px);
            z-index: 1000 !important;
            box-shadow: 4px 0 20px rgba(15, 23, 42, 0.15) !important;
            background: #ffffff !important;
          }
          .crm-flow-toolbar-stats {
            display: none !important;
          }
        }
        @media (max-width: 576px) {
          .crm-flow-toolbar-input {
            min-width: 110px !important;
            max-width: 140px !important;
          }
        }
      `}</style>

      {/* Top toolbar */}
      <div style={{
        height: 52, background: "rgba(255,255,255,0.86)", borderBottom: "1px solid #dbe6f2",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
        flexShrink: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 18, marginRight: 4 }}>⚡</span>
        <input
          value={flowName}
          onChange={e => setFlowName(e.target.value)}
          className="crm-flow-toolbar-input"
          style={{
            fontSize: 14, fontWeight: 600, border: "none", background: "transparent",
            padding: "4px 8px", borderRadius: 4, color: "#0f172a", outline: "none",
            minWidth: 200,
          }}
          onFocus={e => e.target.style.background = "#f1f5f9"}
          onBlur={e => e.target.style.background = "transparent"}
        />

        <button
          onClick={() => setIsElementsSidebarOpen(!isElementsSidebarOpen)}
          style={{
            padding: "6px 12px", fontSize: 12, border: "1px solid #cbd5e1",
            borderRadius: 6, background: isElementsSidebarOpen ? "#eff6ff" : "#fff",
            color: isElementsSidebarOpen ? "#1d4ed8" : "#475569", cursor: "pointer", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s"
          }}
        >
          <i className={`bi ${isElementsSidebarOpen ? "bi-layout-sidebar-inset-reverse" : "bi-layout-sidebar-inset"}`} style={{ fontSize: 14 }}></i>
          <span style={{ display: window.innerWidth < 576 ? "none" : "inline" }}>
            {isElementsSidebarOpen ? "Hide Panel" : "Show Panel"}
          </span>
        </button>

        <div style={{ flex: 1 }} />
        <span className="crm-flow-toolbar-stats" style={{ fontSize: 11, color: "#9ca3af", tabularNums: true }}>
          {nodes.length} node{nodes.length !== 1 ? "s" : ""} · {connections.length} connection{connections.length !== 1 ? "s" : ""}
        </span>
        <button onClick={() => setShowExport(true)} style={{
          padding: "6px 12px", fontSize: 12, border: "1px solid #e5e7eb",
          borderRadius: 6, background: "#fff", cursor: "pointer", color: "#374151", fontWeight: 500,
        }}>Export JSON</button>
        {nodes.length > 0 && (
          <button onClick={saveFlow} style={{
            padding: "6px 14px", fontSize: 12, border: "none",
            borderRadius: 6, background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600
          }}>✓ Save Flow</button>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Sidebar */}
        {isElementsSidebarOpen && (
          <div className="crm-flow-sidebar" style={{ width: 240, background: "rgba(255,255,255,0.9)", borderRight: "1px solid #dbe6f2", display: "flex", flexDirection: "column", flexShrink: 0, backdropFilter: "blur(4px)" }}>
            {/* Sidebar Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6" }}>
              <button
                onClick={() => setActiveSidebarTab("elements")}
                style={{ flex: 1, padding: "12px 0", fontSize: 12, fontWeight: 600, background: activeSidebarTab === "elements" ? "#fff" : "#f8fafc", color: activeSidebarTab === "elements" ? "#1d4ed8" : "#6b7280", border: "none", borderBottom: activeSidebarTab === "elements" ? "2px solid #1d4ed8" : "2px solid transparent", cursor: "pointer", transition: "all 0.15s" }}
              >
                Elements
              </button>
              <button
                onClick={() => setActiveSidebarTab("manager")}
                style={{ flex: 1, padding: "12px 0", fontSize: 12, fontWeight: 600, background: activeSidebarTab === "manager" ? "#fff" : "#f8fafc", color: activeSidebarTab === "manager" ? "#1d4ed8" : "#6b7280", border: "none", borderBottom: activeSidebarTab === "manager" ? "2px solid #1d4ed8" : "2px solid transparent", cursor: "pointer", transition: "all 0.15s" }}
              >
                Manager
              </button>
            </div>

            {activeSidebarTab === "elements" ? (
              <>
                {/* Category filter */}
                <div style={{ padding: "12px 10px 8px", display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button onClick={() => setActiveCategory(null)}
                    style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 12, cursor: "pointer",
                      border: `1px solid ${!activeCategory ? "#1d4ed8" : "#e5e7eb"}`,
                      background: !activeCategory ? "#dbeafe" : "#fff",
                      color: !activeCategory ? "#1d4ed8" : "#6b7280", fontWeight: 500
                    }}>All</button>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                      style={{
                        fontSize: 11, padding: "4px 10px", borderRadius: 12, cursor: "pointer",
                        border: `1px solid ${activeCategory === cat.id ? cat.color : "#e5e7eb"}`,
                        background: activeCategory === cat.id ? cat.color + "22" : "#fff",
                        color: activeCategory === cat.id ? cat.color : "#6b7280", fontWeight: 500
                      }}>{cat.label}</button>
                  ))}
                </div>

                {/* Template list - draggable */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px" }}>
                  {filteredTemplates.map(def => (
                    <div key={def.id}
                      className="sidebar-item"
                      draggable
                      onDragStart={(e) => handleSidebarDragStart(e, def.id)}
                      onClick={() => addNode(def.id)}
                      style={{
                        padding: "10px 12px", borderRadius: 8, cursor: "grab",
                        border: "1px solid #f3f4f6", marginBottom: 6, background: "#fafafa",
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "all 0.15s ease",
                        borderLeft: `3px solid ${def.color}`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = def.bg; e.currentTarget.style.borderColor = def.color + "44"; e.currentTarget.style.borderLeftColor = def.color; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fafafa"; e.currentTarget.style.borderColor = "#f3f4f6"; e.currentTarget.style.borderLeftColor = def.color; }}
                    >
                      <span style={{
                        width: 30, height: 30, borderRadius: 6, background: def.bg,
                        color: def.color, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, flexShrink: 0, border: `1px solid ${def.color}33`
                      }}>{def.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{def.label}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{def.description}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tips */}
                <div style={{ padding: "10px 14px", borderTop: "1px solid #f3f4f6", fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
                  <b>Drag</b> to canvas · <b>Click</b> to add · <b>Double-click</b> node to configure · <b>Scroll</b> to pan · <b>Ctrl+Scroll</b> to zoom
                </div>
              </>
            ) : (
              <>
                {/* Resources Manager */}
                <div style={{ padding: "12px", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  <button onClick={() => setShowResourceModal(true)} style={{ padding: "8px", background: "#f8fafc", border: "1px dashed #9ca3af", color: "#4b5563", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 12, transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"} onMouseLeave={e => e.currentTarget.style.background = "#f8fafc"}>
                    + New Resource
                  </button>
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                    {["Variable", "Constant", "Formula", "Text Template"].map(type => {
                      const items = resources.filter(r => r.type === type);
                      if (items.length === 0) return null;
                      return (
                        <div key={type}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                            {type}s ({items.length})
                          </div>
                          {items.map(res => (
                            <div key={res.id} style={{ padding: "6px 8px", background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#1f2937" }}>{res.apiName}</div>
                              {(res.dataType || res.type) && <div style={{ fontSize: 10, color: "#6b7280" }}>Type: {res.dataType || res.type}</div>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {resources.length === 0 && (
                      <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 20 }}>
                        No resources created yet. Click above to add one.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}


        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: 1, position: "relative", overflow: "hidden",
            cursor: isPanning.current ? "grabbing" : connectingFrom ? "crosshair" : "default",
            background: "linear-gradient(180deg, #f8fbff 0%, #f8fafc 100%)",
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          {/* Transformed canvas layer */}
          <div
            ref={canvasInnerRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            {/* Grid background */}
            <svg style={{ position: "absolute", top: -2000, left: -2000, width: 8000, height: 8000, zIndex: 0 }}>
              <defs>
                <pattern id="grid-dots" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                  <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r="0.8" fill="#d1d5db" />
                </pattern>
                <pattern id="grid-lines" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
                  <rect width={GRID_SIZE * 5} height={GRID_SIZE * 5} fill="url(#grid-dots)" />
                  <line x1="0" y1="0" x2={GRID_SIZE * 5} y2="0" stroke="#e5e7eb" strokeWidth="0.5" />
                  <line x1="0" y1="0" x2="0" y2={GRID_SIZE * 5} stroke="#e5e7eb" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#grid-lines)" />
            </svg>


            {/* Empty state */}
            {nodes.length === 0 && (
              <div style={{
                position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", pointerEvents: "none",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.25 }}>⚡</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>Start building your flow</div>
                <div style={{ fontSize: 13, color: "#d1d5db", marginTop: 6, maxWidth: 280, lineHeight: 1.5 }}>
                  Drag an element from the sidebar or click to add it to the canvas
                </div>
              </div>
            )}


            {/* Connections */}
            <Connections
              connections={connections}
              nodes={nodes}
              mousePos={mousePos}
              connectingFrom={connectingFrom}
              onDeleteConnection={deleteConnection}
              onInlineAddClick={handleInlineAddClick}
            />


            {/* Nodes */}
            {nodes.map(node => (
              <FlowNode
                key={node.id}
                node={node}
                isSelected={selectedId === node.id}
                onSelect={setSelectedId}
                onEdit={setEditingId}
                onDelete={deleteNode}
                onConnectStart={handleConnectStart}
                connectingFrom={connectingFrom}
                onConnectEnd={handleConnectEnd}
                onPositionChange={updateNodePosition}
                scale={scale}
              />
            ))}
          </div>

          {/* Zoom controls (overlay) */}
          <div style={{
            position: "absolute", bottom: 16, left: 16,
            display: "flex", flexDirection: "column", gap: 2,
            background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)", zIndex: 100,
            overflow: "hidden",
          }}>
            <button className="zoom-btn" onClick={zoomIn} style={{
              width: 36, height: 36, border: "none", background: "#fff",
              cursor: "pointer", fontSize: 16, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center",
              borderBottom: "1px solid #f3f4f6",
            }}>+</button>
            <button className="zoom-btn" onClick={zoomFit} style={{
              width: 36, height: 28, border: "none", background: "#fff",
              cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center",
              borderBottom: "1px solid #f3f4f6",
            }}>{Math.round(scale * 100)}%</button>
            <button className="zoom-btn" onClick={zoomOut} style={{
              width: 36, height: 36, border: "none", background: "#fff",
              cursor: "pointer", fontSize: 16, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center",
            }}>−</button>
          </div>

          {/* Minimap */}
          <Minimap nodes={nodes} viewportRect={viewportRect} />
        </div>
      </div>


      {/* Config panel modal */}
      {editingNode && (
        <ConfigPanel
          node={editingNode}
          onClose={() => setEditingId(null)}
          onUpdate={updateNodeConfig}
          resources={resources}
          onAddResource={(newResource) => setResources(prev => [...prev, newResource])}
        />
      )}

      {/* Export modal */}
      {showExport && (
        <ExportModal nodes={nodes} connections={connections} onClose={() => setShowExport(false)} />
      )}

      {/* Resource Modal */}
      {showResourceModal && (
        <ResourceModal onClose={() => setShowResourceModal(false)} onSave={(res) => setResources(prev => [...prev, res])} />
      )}

      {/* Inline Add Menu */}
      {inlineAddMenu && (
        <div style={{
          position: "fixed",
          top: inlineAddMenu.y + 14,
          left: Math.max(14, inlineAddMenu.x - 124),
          width: 248,
          background: "#ffffff",
          border: "1px solid #dbe6f2",
          borderRadius: 12,
          boxShadow: "0 22px 48px rgba(15,23,42,0.18)",
          zIndex: 3000,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          animation: "menuIn 140ms ease-out"
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#74839a",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 2,
            padding: "2px 4px"
          }}>
            Insert Flow Step
          </div>
          {Object.values(TEMPLATE_DEFS).filter(t => t.category === "action" || (t.category === "logic" && t.id !== "end")).map(def => (
            <button key={def.id} onClick={() => insertInlineNode(def.id)}
              style={{
                padding: "8px 10px",
                fontSize: 12,
                border: "1px solid transparent",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#1f2937",
                transition: "all 0.12s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "#f8fbff";
                e.currentTarget.style.borderColor = "#dbe6f2";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <span style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: def.bg,
                color: def.color,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${def.color}33`,
                fontSize: 12,
                fontWeight: 700
              }}>
                {def.icon}
              </span>
              <span style={{ fontWeight: 600 }}>{def.label}</span>
            </button>
          ))}
          <button onClick={() => setInlineAddMenu(null)}
            style={{
              marginTop: 2,
              padding: "6px 10px",
              fontSize: 11,
              border: "1px solid #d1d5db",
              background: "#f8fafc",
              borderRadius: 7,
              cursor: "pointer",
              color: "#6b7280",
              fontWeight: 600
            }}
          >Cancel</button>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
