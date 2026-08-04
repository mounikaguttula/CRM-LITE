function getModuleSubtitle(key, pluralName) {
  const str = String(key || '').toLowerCase();
  if (str.includes('contact')) return "Every person and company you're building a relationship with.";
  if (str.includes('lead')) return 'Potential clients and prospects in your sales pipeline.';
  if (str.includes('deal')) return 'Active business opportunities, contracts, and revenue.';
  if (str.includes('compan') || str.includes('account')) return 'Accounts, organizations, and corporate partners.';
  return `All records and data managed in ${pluralName}.`;
}

function ObjectListContent({ objectTypeId }) {
  const { objectTypes, permissions } = useWorkspace();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  // CSV Import/Export States
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedRecords, setParsedRecords] = useState([]);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    apiGet(`/objects/${objectTypeId}`)
      .then((res)

    const headers = exportKeys.map(k => humanize(k));
    const csvRows = [headers.join(',')];

    for (const rec of listToExport) {
      const rowVals = exportKeys.map(k => {
        let val = rec[k];
        if (val === undefined || val === null) {
          val = rec.data ? rec.data[k] : '';
        }
        val = String(val || '').replace(/"/g, '""');
        return `"${val}"`;
      });
      csvRows.push(rowVals.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${objectTypeId}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV File Upload Processor
  const handleFileProcess = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a valid .csv file.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim());
      if (lines.length < 2) {
        setParsedRecords([]);
        return;
      }

      const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      
      const mapHeader = (h) => {
                            <td style={{ padding: 4, color: '#64748b' }}>{r.email || '—'}</td>
                            <td style={{ padding: 4, color: '#64748b' }}>{r.company || '—'}</td>
                            <td style={{ padding: 4, color: '#10b981', fontWeight: 600 }}>{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => { setImportModalOpen(false); setSelectedFile(null); setParsedRecords([]); }}
                style={{
                  padding: '9px 18px', borderRadius: 10, border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleImportSubmit}
                disabled={!selectedFile || parsedRecords.length === 0 || importing}
                style={{
                  padding: '9px 22px', borderRadius: 10, border: 'none',
                  background: (!selectedFile || parsedRecords.length === 0) ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff', fontWeight: 700, fontSize: 13,
                  cursor: (!selectedFile || parsedRecords.length === 0 || importing) ? 'not-allowed' : 'pointer',
                  boxShadow: (!selectedFile || parsedRecords.length === 0) ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Check size={16} />
                {importing ? 'Importing…' : `Import ${parsedRecords.length} Leads`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewPage() {
  const { objectTypeId } = useParams();
  if (objectTypeId) {
    return <ObjectListContent objectTypeId={objectTypeId} />;
  }
  return <DashboardContent />;
}

export default OverviewPage;
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiGet, apiPost } from '../../api/client';
import {
  Users,
  Columns3,
  Search,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Mail,
  Phone,
  ArrowUpRight,
  SlidersHorizontal,
  Plus,
  Calendar,
  Download,
  UploadCloud,
  Upload,
  X,
  Check,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

/* ---------------------------------- THEME & COLORS ---------------------------------- */

const COLOR = {
  indigo: '#6366f1',
  cyan: '#22d3ee',
  violet: '#a78bfa',
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewPage() {
  const { objectTypeId } = useParams();
  if (objectTypeId) {
    return <ObjectListContent objectTypeId={objectTypeId} />;
  }
  return <DashboardContent />;
}

export default OverviewPage;
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiGet, apiPost } from '../../api/client';
import {
  Users,
  Columns3,
  Search,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Mail,
  Phone,
  ArrowUpRight,
  SlidersHorizontal,
  Plus,
  Calendar,
  Download,
  UploadCloud,
  Upload,
  X,
  Check,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

/* ---------------------------------- THEME & COLORS ---------------------------------- */
Created At: 2026-07-29T15:30:28Z
Completed At: 2026-07-29T15:30:28Z
File Path: `file:///d:/Downloads/LiteWeight-CRM--main%20%282%29/LiteWeight-CRM--main/src/pages/workspace/OverviewPage.js`
Total Lines: 1655
Total Bytes: 72313
Showing lines 1 to 800
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1: import React, { useState, useEffect, useRef } from 'react';
2: import { useNavigate, useParams } from 'react-router-dom';
3: import { useWorkspace } from '../../context/WorkspaceContext';
4: import { apiGet, apiPost } from '../../api/client';
5: import {
6:   Users,
7:   Columns3,
8:   Search,
9:   TrendingUp,
10:   TrendingDown,
11:   MoreHorizontal,
12:   Mail,
13:   Phone,
14:   ArrowUpRight,
15:   SlidersHorizontal,
16:   Plus,
17:   Calendar,
18:   Download,
19:   UploadCloud,
20:   Upload,
21:   X,
22:   Check,
23:   FileSpreadsheet,
24:   CheckCircle2,
25: } from 'lucide-react';
26: import {
27:   AreaChart,
28:   Area,
29:   ResponsiveContainer,
30:   XAxis,
31:   YAxis,
32:   Tooltip,
33: } from 'recharts';
34: 
35: /* ---------------------------------- THEME & COLORS ---------------------------------- */
36: 
37: const COLOR = {
38:   indigo: '#6366f1',
39:  
767:             }}>
768:               <Icon size={15} style={{ color: '#fff' }} />
769:             </div>
770:             <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
771:           </div>
772:           <span style={{
773:             fontSize: '0.65rem', fontWeight: 700,
774:             color: up ? '#059669' : '#dc2626',
775:             background: up ? '#ecfdf5' : '#fef2f2',
776:             padding: '2px 7px', borderRadius: 6,
777:             border: `1px solid ${up ? '#a7f3d0' : '#fecaca'}`,
778:           }}>{delta}</span>
779:         </div>
780: 
781:         {/* Value */}
782:         <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111827', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
783:           {display}
784:         </div>
785:         <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem' }}>
786:           {up ? <TrendingUp size={10} style={{ color: '#059669' }} /> : <TrendingDown size={10} style={{ color: '#dc2626' }} />}
787:           <span style={{ color: '#8990ac' }}>vs last month</span>
788:         </div>
789:       </div>
790: 
791:       {/* Bottom accent glow on hover */}
792:       {hov && (
793:         <div style={{
794:           position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 1,
795:           background: `linear-gradient(90deg, transparent, ${glow}60, transparent)`,
796:         }} />
797:       )}
798:     </div>
799:   );
800: }
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
