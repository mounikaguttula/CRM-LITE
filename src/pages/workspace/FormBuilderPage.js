import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '../../api/client';
import {
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown,
  CheckCircle, Copy, Sparkles, Settings, Palette,
  Type, Mail, Phone, Building, Briefcase, Calendar, Clock, ListFilter,
  FileText, Image as ImageIcon, UserCheck, HelpCircle,
  ChevronDown, ChevronUp, Link as LinkIcon, Monitor, Tablet, Smartphone,
  Zap, Database, Share2, Upload, Eye, Check, ShoppingBag, MessageSquare,
  Globe, Hash, CheckSquare, Radio, ExternalLink, MoreVertical, Layers,
  AlignLeft, AlignCenter, AlignRight, RefreshCw, User, GripVertical, X,
  AlertTriangle, Video, Target, Edit
} from 'lucide-react';

const LinkedinIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const TwitterIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const YoutubeIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const STARTER_TEMPLATES = [
  {
    id: 'webinar_registration',
    name: 'Webinar & Event Registration',
    icon: '🎓',
    form_type: 'webinar_registration',
    description: 'Professional event registration layout with banner header, key takeaways, speaker details, and sticky form card.',
    title: '',
    subtitle: '',
    description_text: '',
    event_date: '',
    event_time: '',
    event_badge: '',
    preset_layout: 'event_registration',
    primaryColor: '#4f46e5',
    bgColor: '#0f172a',
    textColor: '#ffffff',
    buttonText: 'Register Now',
    buttonStyle: 'solid',
    borderRadius: '12px',
    fontFamily: 'Plus Jakarta Sans',
    badges: [],
    learnItems: [],
    speakers: [],
    product_block: {
      enabled: false,
      title: '',
      description: '',
      image_url: '',
      cta_text: '',
      cta_url: ''
    },
    fields: [
      { id: 'f_fn', api_name: 'first_name', label: 'First Name', type: 'text', required: true, placeholder: 'Enter first name', help_text: '', default_value: '', lead_target: 'first_name' },
      { id: 'f_ln', api_name: 'last_name', label: 'Last Name', type: 'text', required: true, placeholder: 'Enter last name', help_text: '', default_value: '', lead_target: 'last_name' },
      { id: 'f_em', api_name: 'email', label: 'Work Email', type: 'email', required: true, placeholder: 'name@company.com', help_text: '', default_value: '', lead_target: 'email' },
      { id: 'f_cp', api_name: 'company', label: 'Company Name', type: 'text', required: false, placeholder: 'e.g. Acme Corp', help_text: '', default_value: '', lead_target: 'company' },
    ]
  },
  {
    id: 'lead_capture',
    name: 'Standard Lead Capture',
    icon: '🎯',
    form_type: 'lead_capture',
    description: 'Clean split layout for website visitors to request consultation or download assets.',
    title: '',
    subtitle: '',
    description_text: '',
    event_date: '', event_time: '', event_badge: '',
    preset_layout: 'split_layout',
    primaryColor: '#4f46e5',
    bgColor: '#f8fafc',
    textColor: '#0f172a',
    buttonText: 'Submit Inquiry',
    buttonStyle: 'solid',
    borderRadius: '8px',
    fontFamily: 'Inter',
    badges: [],
    learnItems: [],
    speakers: [],
    product_block: { enabled: false, title: '', description: '', image_url: '', cta_text: '', cta_url: '' },
    fields: [
      { id: 'f_fn', api_name: 'first_name', label: 'First Name', type: 'text', required: true, placeholder: 'Enter first name', lead_target: 'first_name' },
      { id: 'f_ln', api_name: 'last_name', label: 'Last Name', type: 'text', required: true, placeholder: 'Enter last name', lead_target: 'last_name' },
      { id: 'f_em', api_name: 'email', label: 'Work Email', type: 'email', required: true, placeholder: 'name@company.com', lead_target: 'email' },
      { id: 'f_cp', api_name: 'company', label: 'Company Name', type: 'text', required: false, placeholder: 'e.g. Acme Corp', lead_target: 'company' },
      { id: 'f_msg', api_name: 'message', label: 'How can we help?', type: 'textarea', required: false, placeholder: 'Describe your inquiry…', lead_target: 'description' },
    ]
  }
];

const FIELD_PALETTE_TYPES = [
  { type: 'text', label: 'First Name', api_name: 'first_name', icon: Type, lead_target: 'first_name', placeholder: 'First Name' },
  { type: 'text', label: 'Last Name', api_name: 'last_name', icon: Type, lead_target: 'last_name', placeholder: 'Last Name' },
  { type: 'email', label: 'Email Address', api_name: 'email', icon: Mail, lead_target: 'email', placeholder: 'name@company.com' },
  { type: 'phone', label: 'Phone Number', api_name: 'phone', icon: Phone, lead_target: 'phone', placeholder: '+1 (555) 000-0000' },
  { type: 'text', label: 'Company Name', api_name: 'company', icon: Building, lead_target: 'company', placeholder: 'e.g. Acme Corp' },
  { type: 'text', label: 'Job Title', api_name: 'job_title', icon: Briefcase, lead_target: 'job_title', placeholder: 'e.g. Procurement Manager' },
  { type: 'textarea', label: 'Message / Notes', api_name: 'message', icon: FileText, lead_target: 'description', placeholder: 'Your message here…' },
  { type: 'dropdown', label: 'Dropdown Select', api_name: 'custom_dropdown', icon: ListFilter, lead_target: 'none', placeholder: 'Select option…', options: ['Option 1', 'Option 2', 'Option 3'] },
  { type: 'radio', label: 'Radio Buttons', api_name: 'custom_radio', icon: Radio, lead_target: 'none', options: ['Choice A', 'Choice B'] },
  { type: 'checkbox', label: 'Checkboxes', api_name: 'custom_checkbox', icon: CheckSquare, lead_target: 'none', options: ['Agree to Terms'] },
  { type: 'date', label: 'Date Selection', api_name: 'preferred_date', icon: Calendar, lead_target: 'none' },
  { type: 'number', label: 'Number Input', api_name: 'company_size_num', icon: Hash, lead_target: 'none', placeholder: '10' },
  { type: 'url', label: 'Website URL', api_name: 'website', icon: Globe, lead_target: 'website', placeholder: 'https://company.com' },
];

function FormBuilderPage() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(formId);

  // WORKSPACE MODES: 'build', 'design', 'settings', 'publish'
  const [workspaceMode, setWorkspaceMode] = useState('build');
  const [selectedSectionId, setSelectedSectionId] = useState('hero');
  const [previewDevice, setPreviewDevice] = useState('desktop');

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(!isEditing);
  const [copiedLink, setCopiedLink] = useState(false);

  // Active input focus tracking state
  const [focusedFieldId, setFocusedFieldId] = useState(null);

  // BOTTOM POPUP TOAST NOTIFICATION STATE
  const [toast, setToast] = useState(null);

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Drag & Drop States
  const [draggedFieldIndex, setDraggedFieldIndex] = useState(null);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState(null);

  // Contextual Media Modal State
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaModalTarget, setMediaModalTarget] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [deletingAsset, setDeletingAsset] = useState(false);

  // FORM DATA STATE
  const [name, setName] = useState('Untitled Form');
  const [description, setDescription] = useState('');
  const [formType, setFormType] = useState('lead_capture');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [status, setStatus] = useState('Active');

  // HEADER & NAVIGATION CONTROLS
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [showNavLinks, setShowNavLinks] = useState(false);
  const [navLink1Text, setNavLink1Text] = useState('');
  const [navLink1Target, setNavLink1Target] = useState('');
  const [navLink2Text, setNavLink2Text] = useState('');
  const [navLink2Target, setNavLink2Target] = useState('');

  // HERO CONTENT
  const [headerTitle, setHeaderTitle] = useState('');
  const [headerSubtitle, setHeaderSubtitle] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventBadge, setEventBadge] = useState('');
  const [heroBgImage, setHeroBgImage] = useState('https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200');

  // CUSTOMIZABLE SECTION TITLES
  const [speakersTitle, setSpeakersTitle] = useState('Featured Speaker');
  const [formCardTitle, setFormCardTitle] = useState('Register for the Event');
  const [learnItemsTitle, setLearnItemsTitle] = useState("What You'll Learn");

  // FOOTER & SOCIAL CONTROLS
  const [copyrightText, setCopyrightText] = useState('');
  const [privacyUrl, setPrivacyUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // SECTIONS & CONTENT BLOCKS
  const [sectionsStack, setSectionsStack] = useState([
    { id: 'header', label: 'Header (Logo & Menu)', enabled: true },
    { id: 'hero', label: 'Hero Section', enabled: true },
    { id: 'event_details', label: 'Event Details', enabled: true },
    { id: 'learn_items', label: "What You'll Learn", enabled: true },
    { id: 'speakers', label: 'Featured Speakers', enabled: true },
    { id: 'registration_form', label: 'Registration Form', enabled: true },
    { id: 'product_block', label: 'Product Showcase', enabled: true },
    { id: 'faq', label: 'FAQ Section', enabled: true },
    { id: 'footer', label: 'Footer & Socials', enabled: true },
  ]);

  const [badges, setBadges] = useState([]);
  const [learnItems, setLearnItems] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [productBlock, setProductBlock] = useState({ enabled: false, title: '', description: '', image_url: '', cta_text: '', cta_url: '' });
  const [faqs, setFaqs] = useState([]);
  const [webinarContactEmail, setWebinarContactEmail] = useState('webinars@company.com');

  // FIELDS
  const [fieldsConfig, setFieldsConfig] = useState([
    { id: 'f_fn', api_name: 'first_name', label: 'First Name', type: 'text', required: true, placeholder: 'Enter first name', help_text: '', default_value: '', lead_target: 'first_name' },
    { id: 'f_ln', api_name: 'last_name', label: 'Last Name', type: 'text', required: true, placeholder: 'Enter last name', help_text: '', default_value: '', lead_target: 'last_name' },
    { id: 'f_em', api_name: 'email', label: 'Work Email', type: 'email', required: true, placeholder: 'name@company.com', help_text: '', default_value: '', lead_target: 'email' },
  ]);

  // DESIGN & STYLING
  const [presetLayout, setPresetLayout] = useState('split_layout');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [bgColor, setBgColor] = useState('#0f172a');
  const [textColor, setTextColor] = useState('#ffffff');
  const [submitBtnText, setSubmitBtnText] = useState('Submit Inquiry');
  const [buttonStyle, setButtonStyle] = useState('solid');
  const [borderRadius, setBorderRadius] = useState('12px');
  const [fontFamily, setFontFamily] = useState('Plus Jakarta Sans');
  const [successMsg, setSuccessMsg] = useState('Thank you! Your submission has been received.');

// RFC4122 Standard UUID Generator Fallback
const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

  // PRE-GENERATE VALID FORM UUID FOR NEW FORMS TO PREVENT STORING IN 'forms/new'
  const [activeFormId] = useState(() => formId || generateUUID());

  // MEDIA STORAGE ASSETS
  const [orgMediaLibrary, setOrgMediaLibrary] = useState([]);

  // CRM MAPPING & AUTOMATION
  const [leadSource, setLeadSource] = useState('Webinar Registration');
  const [initialLeadStatus, setInitialLeadStatus] = useState('New');
  const [createLeadOnSubmit, setCreateLeadOnSubmit] = useState(true);
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(true);
  const [confirmationSubject, setConfirmationSubject] = useState('Thank you for registering!');
  const [confirmationBody, setConfirmationBody] = useState('Hi {first_name},\n\nThank you for registering for {event_title}! We look forward to having you join us.\n\nBest regards,\nTRACKnow Team');

  useEffect(() => {
    fetchOrgMedia();
    if (isEditing) {
      loadForm();
    }
  }, [formId]);

  const fetchOrgMedia = async () => {
    try {
      const res = await apiGet('/api/forms/org-media');
      if (res.data || res.success) {
        setOrgMediaLibrary(res.data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch org media:', err.message);
    }
  };

  const loadForm = async () => {
    setLoading(true);
    setError(null);
    try {
      const form = await apiGet(`/api/forms/${formId}`);
      setName(form.name || '');
      setDescription(form.description || '');
      const loadedPreset = form.appearance?.preset_layout || 'split_layout';
      setFormType(form.form_type || (loadedPreset === 'event_registration' ? 'webinar_registration' : 'lead_capture'));
      setSlug(form.slug || '');
      setSlugManuallyEdited(false);
      setStatus(form.status || 'Active');
      if (Array.isArray(form.fields_config)) setFieldsConfig(form.fields_config);
      if (form.header_content) {
        setHeaderTitle(form.header_content.title || '');
        setHeaderSubtitle(form.header_content.subtitle !== undefined && form.header_content.subtitle !== null ? form.header_content.subtitle : (form.description || ''));
        setDescriptionText(form.header_content.description_text || '');
        setEventDate(form.header_content.event_date || '');
        setEventTime(form.header_content.event_time || '');
        setEventBadge(form.header_content.event_badge || '');
        setLogoUrl(form.header_content.logo_url || '');
        setBrandName(form.header_content.brand_name || '');
        setHeroBgImage(form.header_content.hero_bg_image || heroBgImage);
        setShowNavLinks(Boolean(form.header_content.show_nav_links));
        setNavLink1Text(form.header_content.nav_link1_text || '');
        setNavLink1Target(form.header_content.nav_link1_target || '');
        setNavLink2Text(form.header_content.nav_link2_text || '');
        setNavLink2Target(form.header_content.nav_link2_target || '');
        setSpeakersTitle(form.header_content.speakers_title || 'Featured Speaker');
        setFormCardTitle(form.header_content.form_card_title || 'Register for the Event');
        setLearnItemsTitle(form.header_content.learn_items_title || "What You'll Learn");
        if (Array.isArray(form.header_content.badges)) setBadges(form.header_content.badges);
        if (Array.isArray(form.header_content.learn_items)) setLearnItems(form.header_content.learn_items);
        if (Array.isArray(form.header_content.speakers)) setSpeakers(form.header_content.speakers);
        if (form.header_content.product_block) setProductBlock(form.header_content.product_block);
        if (Array.isArray(form.header_content.faqs)) setFaqs(form.header_content.faqs);
        setWebinarContactEmail(form.header_content.webinar_contact_email || form.webinar_contact_email || 'webinars@company.com');

        if (form.header_content.footer) {
          const ft = form.header_content.footer;
          setCopyrightText(ft.copyright_text || '');
          setPrivacyUrl(ft.privacy_url || '');
          setLinkedinUrl(ft.linkedin_url || '');
          setTwitterUrl(ft.twitter_url || '');
          setYoutubeUrl(ft.youtube_url || '');
          setWebsiteUrl(ft.website_url || '');
        }
      }
      if (form.appearance) {
        const d = form.appearance;
        setPresetLayout(d.preset_layout || 'split_layout');
        setPrimaryColor(d.primary_color || '#4f46e5');
        setBgColor(d.background_color || '#0f172a');
        setTextColor(d.text_color || '#ffffff');
        setSubmitBtnText(d.submit_button_text || 'Register Now');
        setButtonStyle(d.button_style || 'solid');
        setBorderRadius(d.border_radius || '12px');
        setFontFamily(d.font_family || 'Plus Jakarta Sans');
        setSuccessMsg(d.success_message || 'Thank you!');
      }
    } catch (err) {
      console.error('Error loading form:', err);
      setError(err.message || 'Failed to load form details.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (tmpl) => {
    setName(tmpl.name);
    setDescription(tmpl.description);
    setFormType(tmpl.form_type || 'custom');
    setSlug(tmpl.id.replace(/_/g, '-'));
    setHeaderTitle(tmpl.title);
    setHeaderSubtitle(tmpl.subtitle || tmpl.description || '');
    if (tmpl.description_text) setDescriptionText(tmpl.description_text);
    if (tmpl.event_date) setEventDate(tmpl.event_date);
    if (tmpl.event_time) setEventTime(tmpl.event_time);
    if (tmpl.event_badge) setEventBadge(tmpl.event_badge);
    if (tmpl.preset_layout) setPresetLayout(tmpl.preset_layout);
    if (tmpl.badges) setBadges(tmpl.badges);
    if (tmpl.learnItems) setLearnItems(tmpl.learnItems);
    if (tmpl.speakers) setSpeakers(tmpl.speakers);
    if (tmpl.speakers_title) setSpeakersTitle(tmpl.speakers_title);
    if (tmpl.form_card_title) setFormCardTitle(tmpl.form_card_title);
    if (tmpl.learn_items_title) setLearnItemsTitle(tmpl.learn_items_title);
    if (tmpl.product_block) setProductBlock(tmpl.product_block);
    setPrimaryColor(tmpl.primaryColor);
    setBgColor(tmpl.bgColor);
    setTextColor(tmpl.textColor);
    setSubmitBtnText(tmpl.buttonText);
    setFieldsConfig(tmpl.fields);
    setShowTemplatesModal(false);
  };

  // Drag & Drop Handlers for Form Fields
  const handleFieldDragStart = (e, index) => {
    setDraggedFieldIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFieldDragOver = (e, index) => {
    e.preventDefault();
    if (draggedFieldIndex === null || draggedFieldIndex === index) return;
    const updated = [...fieldsConfig];
    const item = updated[draggedFieldIndex];
    updated.splice(draggedFieldIndex, 1);
    updated.splice(index, 0, item);
    setDraggedFieldIndex(index);
    setFieldsConfig(updated);
  };

  const handleFieldDragEnd = () => {
    setDraggedFieldIndex(null);
  };

  // Drag & Drop Handlers for Page Sections Stack
  const handleSectionDragStart = (e, index) => {
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (e, index) => {
    e.preventDefault();
    if (draggedSectionIndex === null || draggedSectionIndex === index) return;
    const updated = [...sectionsStack];
    const item = updated[draggedSectionIndex];
    updated.splice(draggedSectionIndex, 1);
    updated.splice(index, 0, item);
    setDraggedSectionIndex(index);
    setSectionsStack(updated);
  };

  const handleSectionDragEnd = () => {
    setDraggedSectionIndex(null);
  };

  const handleContextualFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'File Too Large', 'Maximum allowed image size is 2 MB.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('error', 'Invalid File Type', 'Only JPEG, PNG, and WebP images are supported.');
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        try {
          const res = await apiPost('/api/forms/upload-media', {
            file_name: file.name,
            file_data: base64Data,
            mime_type: file.type,
            form_id: formId || activeFormId,
          });

          if (res.success && res.url) {
            applySelectedImage(res.url);
            setOrgMediaLibrary((prev) => [{ id: `m_${Date.now()}`, name: file.name, url: res.url, path: res.path }, ...prev]);
            showToast('success', 'Media Uploaded', 'Image stored successfully in Supabase Storage.');
          } else {
            throw new Error(res.message || 'Upload failed.');
          }
        } catch (apiErr) {
          console.error('API upload error:', apiErr);
          showToast('error', 'Upload Failed', apiErr.message || 'Failed to upload image to server.');
        } finally {
          setUploadingImage(false);
          setMediaModalOpen(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read error:', err);
      showToast('error', 'File Read Error', 'Failed to read image file.');
      setUploadingImage(false);
    }
  };

  const onRequestDeleteMedia = (item, e) => {
    if (e) e.stopPropagation();
    if (!item) return;
    setDeleteConfirmItem(item);
  };

  const executeDeleteMediaAsset = async () => {
    if (!deleteConfirmItem) return;
    const item = deleteConfirmItem;
    setDeletingAsset(true);

    try {
      let filePath = item.path;
      if (!filePath && item.url) {
        const parts = item.url.split('/storage/v1/object/public/media/');
        if (parts[1]) filePath = decodeURIComponent(parts[1]);
      }

      if (!filePath) {
        showToast('error', 'Delete Error', 'Could not resolve storage path for media asset.');
        setDeleteConfirmItem(null);
        return;
      }

      const res = await apiPost('/api/forms/delete-media', { file_path: filePath });
      if (res.success) {
        setOrgMediaLibrary((prev) => prev.filter((m) => m.id !== item.id && m.url !== item.url));
        showToast('success', 'Asset Deleted', `'${item.name}' removed from Supabase storage.`);
      } else {
        throw new Error(res.message || 'Delete failed.');
      }
    } catch (err) {
      console.error('Delete media error:', err);
      showToast('error', 'Delete Failed', err.message || 'Failed to delete asset from server.');
    } finally {
      setDeletingAsset(false);
      setDeleteConfirmItem(null);
    }
  };

  const applySelectedImage = (url) => {
    if (!mediaModalTarget) return;
    if (mediaModalTarget.section === 'hero') setHeroBgImage(url);
    if (mediaModalTarget.section === 'logo') setLogoUrl(url);
    if (mediaModalTarget.section === 'product') setProductBlock((prev) => ({ ...prev, image_url: url }));
    if (mediaModalTarget.section === 'speaker' && mediaModalTarget.index !== undefined) {
      const updated = [...speakers];
      if (updated[mediaModalTarget.index]) updated[mediaModalTarget.index].avatar_url = url;
      setSpeakers(updated);
    }
  };

  const handleAddFieldFromPalette = (preset) => {
    const newId = `f_${Date.now()}`;
    const newField = {
      id: newId,
      api_name: `${preset.api_name}_${fieldsConfig.length + 1}`,
      label: preset.label,
      type: preset.type,
      required: false,
      placeholder: preset.placeholder || 'e.g. Acme Corp',
      help_text: '',
      default_value: '',
      options: preset.options ? [...preset.options] : [],
      lead_target: preset.lead_target || 'none',
    };
    setFieldsConfig((prev) => [...prev, newField]);
  };

  const handleRemoveField = (id) => {
    if (fieldsConfig.length <= 1) {
      showToast('warning', 'Validation Warning', 'Form must contain at least one field.');
      return;
    }
    setFieldsConfig((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddSpeaker = () => {
    setSpeakers((prev) => [
      ...prev,
      { id: `s_${Date.now()}`, name: 'New Speaker', title: 'Executive Officer', company: 'Partner Corp', bio: 'Industry thought leader.', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' }
    ]);
  };

  const handleRemoveSpeaker = (index) => {
    setSpeakers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddLearnItem = () => {
    setLearnItems((prev) => [...prev, 'New key takeaway item']);
  };

  const handleRemoveLearnItem = (index) => {
    setLearnItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFaq = () => {
    setFaqs((prev) => [...prev, { question: '', answer: '' }]);
  };

  const handleRemoveFaq = (index) => {
    setFaqs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveForm = async () => {
    if (!name.trim()) {
      showToast('warning', 'Required Field', 'Form Name is required.');
      return;
    }
    if (!slug.trim()) {
      showToast('warning', 'Required Field', 'Public URL Slug is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const leadMapping = {};
    fieldsConfig.forEach((f) => {
      if (f.lead_target && f.lead_target !== 'none') {
        leadMapping[f.lead_target] = f.api_name;
      }
    });

    const payload = {
      id: activeFormId,
      name: name.trim(),
      description: description.trim(),
      form_type: formType,
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      status,
      fields_config: fieldsConfig,
      header_content: {
        title: headerTitle || name,
        subtitle: headerSubtitle,
        description_text: descriptionText,
        event_date: eventDate,
        event_time: eventTime,
        event_badge: eventBadge,
        brand_name: brandName,
        logo_url: logoUrl,
        hero_bg_image: heroBgImage,
        show_nav_links: showNavLinks,
        nav_link1_text: navLink1Text,
        nav_link1_target: navLink1Target,
        nav_link2_text: navLink2Text,
        nav_link2_target: navLink2Target,
        speakers_title: speakersTitle || 'Featured Speaker',
        form_card_title: formCardTitle || 'Register for the Event',
        learn_items_title: learnItemsTitle || "What You'll Learn",
        badges,
        learn_items: learnItems,
        speakers,
        product_block: productBlock,
        faqs,
        webinar_contact_email: webinarContactEmail.trim(),
        footer: {
          copyright_text: copyrightText,
          privacy_url: privacyUrl,
          linkedin_url: linkedinUrl,
          twitter_url: twitterUrl,
          youtube_url: youtubeUrl,
          website_url: websiteUrl,
        }
      },
      appearance: {
        preset_layout: presetLayout,
        primary_color: primaryColor,
        background_color: bgColor,
        text_color: textColor,
        submit_button_text: submitBtnText,
        button_style: buttonStyle,
        border_radius: borderRadius,
        font_family: fontFamily,
        success_message: successMsg,
      },
      crm_mapping: {
        ...leadMapping,
        lead_source: leadSource,
        lead_status: initialLeadStatus,
      },
      automation: {
        create_lead: createLeadOnSubmit,
        send_confirmation_email: sendConfirmationEmail,
        confirmation_subject: confirmationSubject,
        confirmation_body: confirmationBody,
      },
    };

    try {
      if (isEditing) {
        await apiPut(`/api/forms/${formId}`, payload);
      } else {
        const res = await apiPost('/api/forms', payload);
        const newForm = res.data || res;
        if (newForm?.id) {
          navigate(`/workspace/forms/${newForm.id}/edit`, { replace: true });
        }
      }
      showToast('success', 'Form Saved & Published!', 'Public URL layout and form configuration updated.');
    } catch (err) {
      console.error('Error saving form:', err);
      showToast('error', 'Save Failed', err.message || 'Failed to update form layout.');
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = `${window.location.origin}/forms/${slug}`;

  const handleCopyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    showToast('success', 'Copied Link!', publicUrl);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#64748b', background: '#f8fafc', minHeight: '100vh' }}>
        Loading Form Builder Workspace…
      </div>
    );
  }

  const previewWidth = previewDevice === 'mobile' ? '375px' : previewDevice === 'tablet' ? '768px' : '100%';

  const getFontStack = (font) => {
    const selected = (font && font !== 'serif' && font !== 'Times New Roman' && font !== 'undefined' && font !== 'null') ? font : 'Plus Jakarta Sans';
    return `'${selected}', 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: getFontStack(fontFamily), color: '#0f172a', display: 'flex', flexDirection: 'column' }}>

      {/* PORTAL RENDERED TOAST NOTIFICATION FIXED TO VIEWPORT WINDOW */}
      {toast && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 999999,
          background: toast.type === 'success' ? '#0f172a' : toast.type === 'warning' ? '#78350f' : '#7f1d1d',
          color: '#ffffff', border: `1px solid ${toast.type === 'success' ? primaryColor : toast.type === 'warning' ? '#d97706' : '#dc2626'}`,
          borderRadius: 14, padding: '14px 22px', boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: 14, backdropFilter: 'blur(10px)',
          minWidth: 300, maxWidth: 440, animation: 'fadeInUp 0.3s ease-out'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {toast.type === 'success' ? <CheckCircle size={18} color="#34d399" /> : <AlertTriangle size={18} color="#fca5a5" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{toast.title}</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>{toast.message}</div>
          </div>
          <X size={16} color="#ffffff" style={{ cursor: 'pointer', marginLeft: 8 }} onClick={() => setToast(null)} />
        </div>,
        document.body
      )}

      {/* STARTER TEMPLATES MODAL PORTALED TO DOCUMENT.BODY */}
      {showTemplatesModal && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.65)',
          WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 20, padding: '32px', maxWidth: 840, width: '100%',
            maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            border: '1px solid rgba(226, 232, 240, 0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)' }}>
                  <Sparkles size={22} color="#ffffff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', letterSpacing: -0.3 }}>Select a Form Starter Template</h2>
                  <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Start with a pre-configured page structure. Everything remains 100% editable.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                style={{
                  border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569',
                  borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontWeight: 800,
                  fontSize: '0.82rem', transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              >
                Skip →
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {[
                {
                  id: 'webinar_registration',
                  name: 'Webinar & Event Registration',
                  description: 'Professional event registration layout with banner header, key takeaways, speaker details, and sticky form card.',
                  icon: <Video size={22} color="#4f46e5" />,
                  bgGlow: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(129, 140, 248, 0.15))',
                  borderGlow: '1px solid rgba(79, 70, 229, 0.25)',
                  badge: 'Event & Webinar',
                  tmplObj: STARTER_TEMPLATES[0]
                },
                {
                  id: 'lead_capture',
                  name: 'Standard Lead Capture',
                  description: 'Clean split layout for website visitors to request consultation or download assets.',
                  icon: <Target size={22} color="#10b981" />,
                  bgGlow: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.15))',
                  borderGlow: '1px solid rgba(16, 185, 129, 0.25)',
                  badge: 'Lead Gen',
                  tmplObj: STARTER_TEMPLATES[1]
                }
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleApplyTemplate(item.tmplObj)}
                  style={{
                    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 22,
                    cursor: 'pointer', transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex',
                    flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 16px 32px rgba(99, 102, 241, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: item.bgGlow, border: item.borderGlow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.icon}
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6366f1', background: '#eef2ff', padding: '3px 10px', borderRadius: 12 }}>
                        {item.badge}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', letterSpacing: -0.2 }}>
                      {item.name}
                    </h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                  </div>

                  <div style={{
                    marginTop: 20, paddingTop: 14, borderTop: '1px solid #f1f5f9',
                    color: '#4f46e5', fontWeight: 800, fontSize: '0.82rem', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <span>Use Template</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONTEXTUAL MEDIA UPLOAD MODAL PORTALED TO DOCUMENT.BODY */}
      {mediaModalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.65)',
          WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '24px', maxWidth: 540, width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Change Image Asset</h3>
              <X size={18} color="#64748b" onClick={() => setMediaModalOpen(false)} style={{ cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f8fafc', padding: 18, borderRadius: 12, border: '2px dashed #cbd5e1', textAlign: 'center' }}>
                <Upload size={28} color="#4f46e5" style={{ marginBottom: 6 }} />
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Upload from Computer</div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 12px' }}>Uploads file directly to Supabase Storage (Max size: 2 MB)</p>
                <input type="file" accept="image/*" onChange={handleContextualFileUpload} disabled={uploadingImage} style={{ fontSize: '0.8rem' }} />
                {uploadingImage && <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#4f46e5', fontWeight: 700 }}>Uploading to storage…</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Choose from Organization Media</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {orgMediaLibrary.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => { applySelectedImage(item.url); setMediaModalOpen(false); }}
                      style={{
                        border: '1px solid #e2e8f0', borderRadius: 10, padding: 6, background: '#f8fafc',
                        cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#6366f1'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    >
                      <button
                        type="button"
                        title="Delete asset from Supabase Storage"
                        onClick={(e) => onRequestDeleteMedia(item, e)}
                        style={{
                          position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                          background: 'rgba(239, 68, 68, 0.9)', color: '#ffffff', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 10, transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.background = '#dc2626'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)'; }}
                      >
                        <Trash2 size={12} color="#ffffff" />
                      </button>

                      <img src={item.url} alt={item.name} style={{ width: '100%', height: 58, objectFit: 'cover', borderRadius: 6 }} />
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginTop: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', padding: '0 2px' }}>{item.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Advanced: Use Image URL</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} placeholder="https://..." style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                  <button type="button" onClick={() => { if (imageUrlInput) { applySelectedImage(imageUrlInput); setMediaModalOpen(false); } }} style={{ border: 'none', background: '#4f46e5', color: '#fff', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL PORTALED TO DOCUMENT.BODY */}
      {deleteConfirmItem && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999999,
          background: 'rgba(15, 23, 42, 0.72)',
          WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 20, padding: 28, maxWidth: 440, width: '100%',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.4)', border: '1px solid #e2e8f0',
            textAlign: 'center', transform: 'scale(1)', transition: 'all 0.2s ease'
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#fef2f2',
              border: '1px solid #fca5a5', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 14px rgba(220, 38, 38, 0.15)'
            }}>
              <Trash2 size={26} color="#dc2626" />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: -0.3 }}>
              Delete Asset from Storage?
            </h3>

            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong style={{ color: '#0f172a' }}>'{deleteConfirmItem.name}'</strong> from Supabase Storage? This will free up storage space.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={deletingAsset}
                style={{
                  flex: 1, padding: '11px 16px', borderRadius: 10, border: '1px solid #cbd5e1',
                  background: '#f8fafc', color: '#475569', fontWeight: 800, fontSize: '0.85rem',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteMediaAsset}
                disabled={deletingAsset}
                style={{
                  flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none',
                  background: '#dc2626', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem',
                  cursor: deletingAsset ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)', transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#b91c1c'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#dc2626'; }}
              >
                {deletingAsset ? 'Deleting…' : 'Delete Asset'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOP COMPACT HEADER */}
      <header style={{
        minHeight: 56, background: '#ffffff', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 18px', flexWrap: 'wrap', gap: '10px 14px',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => navigate('/workspace/forms')}
            style={{ border: 'none', background: 'transparent', color: '#475569', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            ← Back to Forms
          </button>
          <div style={{ height: 20, width: 1, background: '#e2e8f0', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0, background: '#f8fafc', padding: '3px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
            <Edit size={13} color="#64748b" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                const val = e.target.value;
                setName(val);
                if (!slugManuallyEdited) {
                  const autoSlug = val.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                  if (autoSlug) setSlug(autoSlug);
                }
              }}
              placeholder="Form Name"
              title="Click to edit Form Name"
              style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', border: 'none', outline: 'none', background: 'transparent', flex: '1 1 auto', minWidth: 120, maxWidth: 220, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            />
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 800, background: '#dcfce7', color: '#166534', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ● {status}
            </span>
          </div>
        </div>

        {/* WORKSPACE MODES */}
        <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', padding: 3, borderRadius: 8, flexShrink: 0 }}>
          {[
            { id: 'build', label: 'BUILD', icon: Layers },
            { id: 'design', label: 'DESIGN', icon: Palette },
            { id: 'settings', label: 'SETTINGS', icon: Settings },
            { id: 'publish', label: 'PUBLISH', icon: Share2 },
          ].map((mode) => {
            const Icon = mode.icon;
            const isActive = workspaceMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setWorkspaceMode(mode.id)}
                style={{
                  border: 'none', background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#4f46e5' : '#64748b', padding: '6px 12px', borderRadius: 6,
                  fontWeight: isActive ? 800 : 700, fontSize: '0.78rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5, boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  whiteSpace: 'nowrap', transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} /> {mode.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.15s ease' }}
          >
            <Eye size={14} /> Preview
          </a>
          <button
            type="button"
            onClick={handleSaveForm}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,70,229,0.3)', whiteSpace: 'nowrap', transition: 'all 0.15s ease' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
          >
            Update & Publish
          </button>
        </div>
      </header>

      {/* 3-PANEL WORKSPACE */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 340px 1fr', flex: 1, overflow: 'hidden' }}>

        {/* 1. LEFT PANEL: SECTIONS STACK */}
        <div style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              PAGE SECTIONS (DRAG TO REORDER)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sectionsStack.map((sec, idx) => {
                const isSelected = selectedSectionId === sec.id && workspaceMode === 'build';
                return (
                  <div
                    key={sec.id}
                    draggable
                    onDragStart={(e) => handleSectionDragStart(e, idx)}
                    onDragOver={(e) => handleSectionDragOver(e, idx)}
                    onDragEnd={handleSectionDragEnd}
                    onClick={() => { setSelectedSectionId(sec.id); setWorkspaceMode('build'); }}
                    style={{
                      padding: '10px 12px', borderRadius: 8, border: '1px solid',
                      borderColor: isSelected ? '#4f46e5' : '#e2e8f0',
                      background: isSelected ? '#eef2ff' : '#ffffff',
                      color: isSelected ? '#4f46e5' : '#334155',
                      fontSize: '0.8rem', fontWeight: isSelected ? 700 : 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'grab', opacity: draggedSectionIndex === idx ? 0.4 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GripVertical size={16} color="#94a3b8" />
                      <span>{sec.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>Live Builder Active</div>
            <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#64748b' }}>Select any section on left to configure options.</p>
          </div>
        </div>

        {/* 2. CENTER PANEL: CONTEXTUAL SECTION EDITOR */}
        <div style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: 20, overflowY: 'auto' }}>

          {/* BUILD MODE */}
          {workspaceMode === 'build' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                  Edit: {sectionsStack.find((s) => s.id === selectedSectionId)?.label || 'Section'}
                </h3>
              </div>

              {/* HEADER & NAVIGATION CONTROLS */}
              {selectedSectionId === 'header' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Brand / Company Name</label>
                    <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. Acme Corp" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Brand Logo Image</label>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" style={{ maxHeight: 40, objectFit: 'contain', marginBottom: 6 }} />
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6 }}>No logo selected (using text badge).</div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => { setMediaModalTarget({ section: 'logo' }); setMediaModalOpen(true); }} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#4f46e5' }}>
                        Change Logo Image
                      </button>
                      {logoUrl && (
                        <button type="button" onClick={() => setLogoUrl('')} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#dc2626' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Header Navigation Links</span>
                      <input type="checkbox" checked={showNavLinks} onChange={(e) => setShowNavLinks(e.target.checked)} style={{ width: 16, height: 16 }} />
                    </div>

                    {showNavLinks && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>Link 1 Label & Target</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input type="text" value={navLink1Text} onChange={(e) => setNavLink1Text(e.target.value)} placeholder="About" style={{ width: '50%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                            <input type="text" value={navLink1Target} onChange={(e) => setNavLink1Target(e.target.value)} placeholder="#learn" style={{ width: '50%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>Link 2 Label & Target</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input type="text" value={navLink2Text} onChange={(e) => setNavLink2Text(e.target.value)} placeholder="Speakers" style={{ width: '50%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                            <input type="text" value={navLink2Target} onChange={(e) => setNavLink2Target(e.target.value)} placeholder="#speakers" style={{ width: '50%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FOOTER & SOCIAL CONTROLS */}
              {selectedSectionId === 'footer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Copyright Line</label>
                    <input type="text" value={copyrightText} onChange={(e) => setCopyrightText(e.target.value)} placeholder="e.g. © 2026 Acme Inc. All rights reserved." style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Privacy Policy Link URL</label>
                    <input type="text" value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)} placeholder="e.g. https://acme.com/privacy" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Social Media Profiles</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>LinkedIn Profile URL</label>
                        <input type="text" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="e.g. https://linkedin.com/company/acme" style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>Twitter / X URL</label>
                        <input type="text" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="e.g. https://twitter.com/acme" style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>YouTube Channel URL</label>
                        <input type="text" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="e.g. https://youtube.com/@acme" style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>Official Website URL</label>
                        <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="e.g. https://acme.com" style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* HERO SECTION CONTROLS */}
              {selectedSectionId === 'hero' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Badge 1</label>
                    <input type="text" value={badges[0] || ''} onChange={(e) => { const updated = [...badges]; updated[0] = e.target.value; setBadges(updated); }} placeholder="e.g. AI-POWERED PLATFORM" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Badge 2</label>
                    <input type="text" value={badges[1] || ''} onChange={(e) => { const updated = [...badges]; updated[1] = e.target.value; setBadges(updated); }} placeholder="e.g. NATIVE EXTENSION" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Headline</label>
                    <textarea rows={3} value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} placeholder="e.g. The Invisible Costs of Procurement: What Your ERP Isn't Telling You" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Subheadline</label>
                    <textarea rows={3} value={headerSubtitle} onChange={(e) => setHeaderSubtitle(e.target.value)} placeholder="e.g. Your ERP records every purchase, but it rarely tells you what a request actually means for your business." style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Hero Background Image</label>
                    <img src={heroBgImage} alt="Hero BG" style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />
                    <button type="button" onClick={() => { setMediaModalTarget({ section: 'hero' }); setMediaModalOpen(true); }} style={{ width: '100%', padding: '7px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#4f46e5' }}>
                      Change Background Image
                    </button>
                  </div>
                </div>
              )}

              {/* EVENT DETAILS CONTROLS */}
              {selectedSectionId === 'event_details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Event Date</label>
                    <input type="text" value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="July 15, 2026" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Event Time</label>
                    <input type="text" value={eventTime} onChange={(e) => setEventTime(e.target.value)} placeholder="11:00 AM EST" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Event Type Badge</label>
                    <input type="text" value={eventBadge} onChange={(e) => setEventBadge(e.target.value)} placeholder="Live Interactive Webinar" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Webinar Contact Email</label>
                    <input type="email" value={webinarContactEmail} onChange={(e) => setWebinarContactEmail(e.target.value)} placeholder="webinars@company.com" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 3 }}>Displayed to visitors on public webinar form if they need help.</div>
                  </div>
                </div>
              )}

              {/* WHAT YOU'LL LEARN CONTROLS */}
              {selectedSectionId === 'learn_items' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Section Header Title (e.g. What You'll Learn, Key Benefits, Agenda)
                    </label>
                    <input
                      type="text"
                      value={learnItemsTitle}
                      onChange={(e) => setLearnItemsTitle(e.target.value)}
                      placeholder="e.g. What You'll Learn, Key Benefits"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Takeaway Bullets</label>
                    <button type="button" onClick={handleAddLearnItem} style={{ border: 'none', background: '#eef2ff', color: '#4f46e5', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>+ Add Bullet</button>
                  </div>
                  {learnItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="text" value={item} onChange={(e) => { const updated = [...learnItems]; updated[idx] = e.target.value; setLearnItems(updated); }} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                      <Trash2 size={14} color="#ef4444" onClick={() => handleRemoveLearnItem(idx)} style={{ cursor: 'pointer' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* SPEAKERS CONTROLS */}
              {selectedSectionId === 'speakers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Speakers / Team Section</label>
                    <button type="button" onClick={handleAddSpeaker} style={{ border: 'none', background: '#eef2ff', color: '#4f46e5', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>+ Add Member</button>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Section Header Title (e.g. Featured Speaker, Team Lead, Mentor)
                    </label>
                    <input
                      type="text"
                      value={speakersTitle}
                      onChange={(e) => setSpeakersTitle(e.target.value)}
                      placeholder="e.g. Featured Speaker, Team Lead, Mentor"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700 }}
                    />
                  </div>
                  {speakers.map((spk, idx) => (
                    <div key={spk.id || idx} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <img src={spk.avatar_url} alt={spk.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                        <Trash2 size={14} color="#ef4444" onClick={() => handleRemoveSpeaker(idx)} style={{ cursor: 'pointer' }} />
                      </div>
                      <button type="button" onClick={() => { setMediaModalTarget({ section: 'speaker', index: idx }); setMediaModalOpen(true); }} style={{ border: 'none', background: '#eff6ff', color: '#4f46e5', padding: '5px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Change Speaker Photo</button>
                      <input type="text" value={spk.name} onChange={(e) => { const updated = [...speakers]; updated[idx].name = e.target.value; setSpeakers(updated); }} placeholder="Speaker Name" style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700 }} />
                      <input type="text" value={spk.title} onChange={(e) => { const updated = [...speakers]; updated[idx].title = e.target.value; setSpeakers(updated); }} placeholder="Job Title" style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                      <input type="text" value={spk.company} onChange={(e) => { const updated = [...speakers]; updated[idx].company = e.target.value; setSpeakers(updated); }} placeholder="Company" style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                      <textarea rows={2} value={spk.bio || ''} onChange={(e) => { const updated = [...speakers]; updated[idx].bio = e.target.value; setSpeakers(updated); }} placeholder="Speaker Bio" style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.72rem' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* REGISTRATION FORM FIELD CONTROLS WITH EDITABLE PLACEHOLDERS */}
              {selectedSectionId === 'registration_form' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>Form Header Title</label>
                      <input
                        type="text"
                        value={formCardTitle}
                        onChange={(e) => setFormCardTitle(e.target.value)}
                        placeholder="e.g. Register for the Event, Get in Touch"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>Submit Button Text</label>
                      <input
                        type="text"
                        value={submitBtnText}
                        onChange={(e) => setSubmitBtnText(e.target.value)}
                        placeholder="e.g. Submit, Register Now, Join Event"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#4f46e5', marginBottom: 8 }}>+ Add Form Field</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {FIELD_PALETTE_TYPES.map((preset) => (
                        <button key={preset.label} type="button" onClick={() => handleAddFieldFromPalette(preset)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                          + {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Form Fields List (Drag ::: to Reorder)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {fieldsConfig.map((field, idx) => (
                      <div
                        key={field.id}
                        draggable
                        onDragStart={(e) => handleFieldDragStart(e, idx)}
                        onDragOver={(e) => handleFieldDragOver(e, idx)}
                        onDragEnd={handleFieldDragEnd}
                        style={{
                          background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12,
                          cursor: 'grab', opacity: draggedFieldIndex === idx ? 0.4 : 1, transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <GripVertical size={16} color="#64748b" style={{ cursor: 'grab' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{field.label || 'Field'} {field.required && '*'}</span>
                          </div>
                          <Trash2 size={14} color="#ef4444" onClick={() => handleRemoveField(field.id)} style={{ cursor: 'pointer' }} />
                        </div>

                        {/* Field Label Input */}
                        <div style={{ marginBottom: 6 }}>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Field Label</label>
                          <input
                            type="text"
                            value={field.label || ''}
                            onChange={(e) => {
                              const updated = [...fieldsConfig];
                              updated[idx].label = e.target.value;
                              setFieldsConfig(updated);
                            }}
                            placeholder="Field Label"
                            style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                          />
                        </div>

                        {/* Placeholder Input (e.g. Acme Corp) */}
                        <div style={{ marginBottom: 6 }}>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Placeholder Text (e.g. Acme Corp)</label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => {
                              const updated = [...fieldsConfig];
                              updated[idx].placeholder = e.target.value;
                              setFieldsConfig(updated);
                            }}
                            placeholder="e.g. Acme Corp"
                            style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                          />
                        </div>

                        {/* Dropdown / Radio Options Input */}
                        {['dropdown', 'radio', 'checkbox'].includes(field.type) && (
                          <div style={{ marginBottom: 6 }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Options (Comma-separated)</label>
                            <input
                              type="text"
                              value={(field.options || []).join(', ')}
                              onChange={(e) => {
                                const updated = [...fieldsConfig];
                                updated[idx].options = e.target.value.split(',').map((opt) => opt.trim());
                                setFieldsConfig(updated);
                              }}
                              placeholder="Option 1, Option 2, Option 3"
                              style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                            />
                          </div>
                        )}

                        {/* Required Checkbox */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(field.required)}
                            onChange={(e) => {
                              const updated = [...fieldsConfig];
                              updated[idx].required = e.target.checked;
                              setFieldsConfig(updated);
                            }}
                            id={`req_${field.id}`}
                          />
                          <label htmlFor={`req_${field.id}`} style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Required Field</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PRODUCT BLOCK CONTROLS */}
              {selectedSectionId === 'product_block' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Enable Product Showcase</span>
                    <input type="checkbox" checked={Boolean(productBlock?.enabled)} onChange={(e) => setProductBlock((prev) => ({ ...prev, enabled: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Product Title</label>
                    <input type="text" value={productBlock?.title || ''} onChange={(e) => setProductBlock((prev) => ({ ...prev, title: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Product Description</label>
                    <textarea rows={3} value={productBlock?.description || ''} onChange={(e) => setProductBlock((prev) => ({ ...prev, description: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Product Image</label>
                    <img src={productBlock?.image_url} alt="Product" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />
                    <button type="button" onClick={() => { setMediaModalTarget({ section: 'product' }); setMediaModalOpen(true); }} style={{ width: '100%', padding: '7px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#4f46e5' }}>
                      Change Product Image
                    </button>
                  </div>
                </div>
              )}

              {/* FAQ CONTROLS */}
              {selectedSectionId === 'faq' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>FAQ Accordion</label>
                    <button type="button" onClick={handleAddFaq} style={{ border: 'none', background: '#eef2ff', color: '#4f46e5', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>+ Add Question</button>
                  </div>
                  {faqs.map((faq, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Q{idx + 1}</span>
                        <Trash2 size={14} color="#ef4444" onClick={() => handleRemoveFaq(idx)} style={{ cursor: 'pointer' }} />
                      </div>
                      <input type="text" value={faq.question} onChange={(e) => { const updated = [...faqs]; updated[idx].question = e.target.value; setFaqs(updated); }} placeholder="Enter your question" style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700 }} />
                      <textarea rows={2} value={faq.answer} onChange={(e) => { const updated = [...faqs]; updated[idx].answer = e.target.value; setFaqs(updated); }} placeholder="Enter the answer" style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.75rem' }} />
                    </div>
                  ))}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Webinar Support Contact Email</label>
                    <input type="email" value={webinarContactEmail} onChange={(e) => setWebinarContactEmail(e.target.value)} placeholder="webinars@company.com" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 3 }}>Displayed under FAQs as a clickable mailto: link for visitors.</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DESIGN MODE */}
          {workspaceMode === 'design' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Visual Styling & Page Layout</h3>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Page Layout Preset</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 'split_layout', name: '🎯 Split Layout (50/50 Side-by-Side)', desc: 'Clean 50/50 split screen without top hero banner' },
                    { id: 'event_registration', name: '🎓 Event Landing (Header Banner)', desc: 'Hero top banner + 2-column content flow' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPresetLayout(preset.id)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                        border: presetLayout === preset.id ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                        background: presetLayout === preset.id ? '#eef2ff' : '#ffffff',
                        cursor: 'pointer', transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.82rem', color: presetLayout === preset.id ? '#4f46e5' : '#0f172a' }}>{preset.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Primary Brand Accent</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['#4f46e5', '#2563eb', '#10b981', '#06b6d4', '#f59e0b', '#dc2626', '#0f172a'].map((clr) => (
                    <button key={clr} type="button" onClick={() => setPrimaryColor(clr)} style={{ width: 28, height: 28, borderRadius: '50%', background: clr, border: primaryColor === clr ? '3px solid #000' : 'none', cursor: 'pointer', transition: 'transform 0.15s ease' }} />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Submit Button Label</label>
                <input type="text" value={submitBtnText} onChange={(e) => setSubmitBtnText(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
              </div>
            </div>
          )}

          {/* SETTINGS MODE */}
          {workspaceMode === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Form Settings & CRM Mapping</h3>
              
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>Form Identity & Link</label>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Form Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setName(val);
                      if (!slugManuallyEdited) {
                        const autoSlug = val.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                        if (autoSlug) setSlug(autoSlug);
                      }
                    }}
                    placeholder="e.g. Contact Us Form"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Form Type & Template Purpose</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const selectedType = e.target.value;
                      setFormType(selectedType);
                      if (selectedType === 'webinar_registration') {
                        setPresetLayout('event_registration');
                        setFormCardTitle('Register for the Event');
                        setSubmitBtnText('Register Now');
                      } else {
                        setPresetLayout('split_layout');
                        setFormCardTitle('Submit Request');
                        setSubmitBtnText('Submit Inquiry');
                      }
                    }}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, background: '#ffffff', cursor: 'pointer' }}
                  >
                    <option value="lead_capture">🎯 Standard Lead Capture Form (No Attendance Tracking)</option>
                    <option value="webinar_registration">🎓 Webinar & Event Registration (Includes Attendance Tracking)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Custom Public URL Slug</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 8px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>/forms/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                        setSlugManuallyEdited(true);
                      }}
                      placeholder="custom-link-name"
                      style={{ flex: 1, padding: '7px 4px', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                    Link: <code style={{ color: '#4f46e5', fontWeight: 700 }}>/forms/{slug}</code>
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Form Field → CRM Lead Field</label>
                {fieldsConfig.map((f) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{f.label}</span>
                    <select value={f.lead_target || 'none'} onChange={(e) => {
                      const updated = fieldsConfig.map((item) => item.id === f.id ? { ...item, lead_target: e.target.value } : item);
                      setFieldsConfig(updated);
                    }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.75rem' }}>
                      <option value="none">Ignore</option>
                      <option value="first_name">Lead First Name</option>
                      <option value="last_name">Lead Last Name</option>
                      <option value="email">Lead Email</option>
                      <option value="phone">Lead Phone / Mobile</option>
                      <option value="company">Lead Company</option>
                      <option value="job_title">Lead Job Title</option>
                      <option value="designation">Lead Designation / Role</option>
                      <option value="address">Lead Address / Country</option>
                      <option value="number_of_employees">Company Size / Employees</option>
                      <option value="industry">Lead Industry</option>
                      <option value="description">Lead Notes / Description</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PUBLISH MODE */}
          {workspaceMode === 'publish' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Publish & Share Settings</h3>
              
              <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.8rem', fontWeight: 700 }}>
                ✓ Public URL Active
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Form Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (!slugManuallyEdited) {
                      const autoSlug = val.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                      if (autoSlug) setSlug(autoSlug);
                    }
                  }}
                  placeholder="e.g. Contact Us Form"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Customize Public URL Link (/forms/...)</label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>/forms/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                      setSlugManuallyEdited(true);
                    }}
                    placeholder="custom-link-name"
                    style={{ flex: 1, padding: '7px 4px', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5' }}
                  />
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.76rem', color: '#475569', wordBreak: 'break-all' }}>
                <strong style={{ color: '#0f172a' }}>Live Public URL:</strong><br />
                <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 700 }}>
                  {publicUrl}
                </a>
              </div>

              <button type="button" onClick={handleCopyPublicLink} style={{ padding: '9px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', transition: 'transform 0.15s ease' }}>
                {copiedLink ? 'Copied Public Link!' : 'Copy Link'}
              </button>
            </div>
          )}

        </div>

        {/* 3. RIGHT PANEL: DOMINANT REAL WEBSITE LIVE PREVIEW */}
        <div style={{ background: '#cbd5e1', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>

          {/* Viewport Control Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: previewWidth, maxWidth: '100%', marginBottom: 12, background: '#ffffff', padding: '8px 16px', borderRadius: 10, border: '1px solid #94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
              <span style={{ color: '#10b981' }}>●</span> Live Preview ({presetLayout === 'split_layout' ? '50/50 Split View' : 'Header Banner View'})
            </div>

            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 2, borderRadius: 6 }}>
              <button type="button" onClick={() => setPreviewDevice('desktop')} style={{ border: 'none', background: previewDevice === 'desktop' ? '#fff' : 'transparent', color: previewDevice === 'desktop' ? '#4f46e5' : '#64748b', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Monitor size={12} /> Desktop
              </button>
              <button type="button" onClick={() => setPreviewDevice('tablet')} style={{ border: 'none', background: previewDevice === 'tablet' ? '#fff' : 'transparent', color: previewDevice === 'tablet' ? '#4f46e5' : '#64748b', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tablet size={12} /> Tablet
              </button>
              <button type="button" onClick={() => setPreviewDevice('mobile')} style={{ border: 'none', background: previewDevice === 'mobile' ? '#fff' : 'transparent', color: previewDevice === 'mobile' ? '#4f46e5' : '#64748b', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Smartphone size={12} /> Mobile
              </button>
            </div>
          </div>

          {/* REAL PUBLIC WEBSITE FRAME PREVIEW */}
          <div
            style={{
              width: previewWidth, maxWidth: '100%', background: '#ffffff', borderRadius: 12,
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', fontFamily: getFontStack(fontFamily)
            }}
          >
            {/* Header Section */}
            <div
              onClick={() => { setSelectedSectionId('header'); setWorkspaceMode('build'); }}
              style={{
                height: 56, padding: '0 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                border: selectedSectionId === 'header' && workspaceMode === 'build' ? '2px solid #4f46e5' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    style={{ height: 42, maxHeight: 44, width: 'auto', objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))' }}
                  />
                ) : brandName ? (
                  <div style={{ padding: '5px 12px', borderRadius: 6, background: primaryColor, color: '#ffffff', fontWeight: 900, fontSize: '0.85rem', letterSpacing: -0.3, boxShadow: `0 2px 8px ${primaryColor}40` }}>
                    {brandName}
                  </div>
                ) : null}
                {logoUrl && brandName && (
                  <span style={{ fontWeight: 900, fontSize: '0.98rem', color: '#0f172a', letterSpacing: -0.5 }}>{brandName}</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {showNavLinks && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                    {navLink1Text && <a href={navLink1Target} style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.15s ease' }}>{navLink1Text}</a>}
                    {navLink2Text && <a href={navLink2Target} style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.15s ease' }}>{navLink2Text}</a>}
                  </div>
                )}
                <button type="button" style={{ border: 'none', background: primaryColor, color: '#fff', borderRadius: 6, padding: '6px 14px', fontWeight: 700, fontSize: '0.75rem', transition: 'transform 0.15s ease' }}>
                  {submitBtnText}
                </button>
              </div>
            </div>

            {/* DYNAMIC LAYOUT PRESET */}
            {presetLayout === 'split_layout' ? (
              /* TRUE 50/50 SIDE-BY-SIDE SPLIT VIEW */
              <div style={{ padding: 32, background: '#f8fafc', display: 'grid', gridTemplateColumns: previewDevice === 'desktop' ? '1fr 1fr' : '1fr', gap: 28, alignItems: 'start' }}>
                <div onClick={() => { setSelectedSectionId('hero'); setWorkspaceMode('build'); }} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {badges.map((b, i) => (
                      <span key={i} style={{ background: primaryColor, color: '#ffffff', padding: '3px 10px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 800 }}>
                        {b}
                      </span>
                    ))}
                  </div>

                  <h1 style={{ margin: 0, fontSize: previewDevice === 'mobile' ? '1.3rem' : '1.7rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                    {headerTitle || (name && name !== 'Untitled Form' ? name : 'Form Title')}
                  </h1>

                  {headerSubtitle && (
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
                      {headerSubtitle}
                    </p>
                  )}

                  {learnItems.length > 0 && (
                    <div id="learn" style={{ background: '#ffffff', borderRadius: borderRadius, padding: 18, border: '1px solid #e2e8f0', transition: 'all 0.25s ease' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 800 }}>{learnItemsTitle || "What You'll Learn"}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {learnItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 8, fontSize: '0.78rem', color: '#334155' }}>
                            <span style={{ color: primaryColor, fontWeight: 900 }}>✓</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {speakers.length > 0 && (
                    <div id="speakers" style={{ background: '#ffffff', borderRadius: borderRadius, padding: 18, border: '1px solid #e2e8f0', transition: 'all 0.25s ease' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a', marginBottom: 12 }}>{speakersTitle || 'Featured Speaker'}</div>
                      {speakers.map((spk, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: idx < speakers.length - 1 ? 14 : 0 }}>
                          <img src={spk.avatar_url} alt={spk.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${primaryColor}`, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{spk.name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', margin: '1px 0 4px' }}>{spk.title}, {spk.company}</div>
                            {spk.bio && <p style={{ margin: 0, fontSize: '0.74rem', color: '#475569', lineHeight: 1.5, textAlign: 'justify' }}>{spk.bio}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  onClick={() => { setSelectedSectionId('registration_form'); setWorkspaceMode('build'); }}
                  style={{
                    background: '#ffffff', borderRadius: borderRadius, padding: 24,
                    border: selectedSectionId === 'registration_form' && workspaceMode === 'build' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.06)', cursor: 'pointer', position: 'sticky', top: 12,
                    transition: 'all 0.25s ease'
                  }}
                >
                  <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                    {formCardTitle || 'Register for the Event'}
                  </h3>
                  <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {fieldsConfig.map((f) => (
                      <div key={f.id}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                          {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                        </label>
                        {f.type === 'dropdown' ? (
                          <select
                            onFocus={() => setFocusedFieldId(f.id)}
                            onBlur={() => setFocusedFieldId(null)}
                            style={{
                              width: '100%', padding: '7px 10px', borderRadius: 6,
                              border: focusedFieldId === f.id ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                              boxShadow: focusedFieldId === f.id ? `0 0 0 3px ${primaryColor}30` : 'none',
                              fontSize: '0.78rem', outline: 'none', transition: 'all 0.2s ease', background: '#fff'
                            }}
                          >
                            <option value="">Select option…</option>
                            {(f.options || []).map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder={f.placeholder || ''}
                            onFocus={() => setFocusedFieldId(f.id)}
                            onBlur={() => setFocusedFieldId(null)}
                            style={{
                              width: '100%', padding: '7px 10px', borderRadius: 6,
                              border: focusedFieldId === f.id ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                              boxShadow: focusedFieldId === f.id ? `0 0 0 3px ${primaryColor}30` : 'none',
                              fontSize: '0.78rem', outline: 'none', transition: 'all 0.2s ease'
                            }}
                          />
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      style={{
                        width: '100%', padding: '9px', borderRadius: borderRadius, border: 'none',
                        background: primaryColor, color: '#ffffff', fontWeight: 800, fontSize: '0.82rem',
                        cursor: 'pointer', marginTop: 4, transition: 'all 0.2s ease'
                      }}
                    >
                      {submitBtnText} →
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* EVENT REGISTRATION HEADER BANNER VIEW */
              <>
                <div
                  onClick={() => { setSelectedSectionId('hero'); setWorkspaceMode('build'); }}
                  style={{
                    background: `radial-gradient(circle at 50% 20%, rgba(79, 70, 229, 0.45) 0%, rgba(15, 23, 42, 0.95) 75%), url(${heroBgImage}) center/cover`,
                    color: '#ffffff', padding: '42px 28px', textAlign: 'center',
                    cursor: 'pointer', border: selectedSectionId === 'hero' && workspaceMode === 'build' ? '2px solid #6366f1' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
                    {badges.map((b, i) => (
                      <span key={i} style={{ background: primaryColor, color: '#ffffff', padding: '4px 12px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 800, boxShadow: `0 2px 8px ${primaryColor}40` }}>
                        {b}
                      </span>
                    ))}
                  </div>

                  <h1 style={{ margin: '0 0 10px', fontSize: previewDevice === 'mobile' ? '1.3rem' : '1.7rem', fontWeight: 900, lineHeight: 1.2 }}>
                    {headerTitle || (name && name !== 'Untitled Form' ? name : 'Form Title')}
                  </h1>

                  {headerSubtitle && (
                    <p style={{ margin: '0 0 18px', fontSize: '0.88rem', opacity: 0.9, lineHeight: 1.5, color: '#cbd5e1' }}>
                      {headerSubtitle}
                    </p>
                  )}

                  {(eventDate || eventTime || eventBadge) && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 14,
                      background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255, 255, 255, 0.18)', borderRadius: 14, padding: '9px 20px',
                      fontSize: '0.78rem', fontWeight: 700
                    }}>
                      {eventDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={14} color="#818cf8" />
                          <span>{eventDate}</span>
                        </div>
                      )}
                      {eventTime && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} color="#818cf8" />
                          <span>{eventTime}</span>
                        </div>
                      )}
                      {eventBadge && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)',
                          color: '#fca5a5', padding: '3px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 800
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
                          <span>{eventBadge}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ padding: 24, background: '#f8fafc', display: 'grid', gridTemplateColumns: previewDevice === 'desktop' ? '1.3fr 1fr' : '1fr', gap: 24, alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div
                      id="learn"
                      onClick={() => { setSelectedSectionId('learn_items'); setWorkspaceMode('build'); }}
                      style={{ background: '#ffffff', borderRadius: borderRadius, padding: 20, border: selectedSectionId === 'learn_items' && workspaceMode === 'build' ? '2px solid #4f46e5' : '1px solid #e2e8f0', cursor: 'pointer' }}
                    >
                      <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{learnItemsTitle || "What You'll Learn"}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {learnItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
                            <span style={{ color: primaryColor, fontWeight: 900 }}>✓</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {speakers.length > 0 && (
                      <div
                        id="speakers"
                        onClick={() => { setSelectedSectionId('speakers'); setWorkspaceMode('build'); }}
                        style={{ background: '#ffffff', borderRadius: borderRadius, padding: 20, border: selectedSectionId === 'speakers' && workspaceMode === 'build' ? '2px solid #4f46e5' : '1px solid #e2e8f0', cursor: 'pointer' }}
                      >
                        <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{speakersTitle || 'Featured Speaker'}</h3>
                        {speakers.map((spk, idx) => (
                          <div key={spk.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: idx < speakers.length - 1 ? 16 : 0 }}>
                            <img src={spk.avatar_url} alt={spk.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${primaryColor}`, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{spk.name}</div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 4px' }}>{spk.title}, {spk.company}</div>
                              {spk.bio && <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.5, textAlign: 'justify' }}>{spk.bio}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => { setSelectedSectionId('registration_form'); setWorkspaceMode('build'); }}
                    style={{
                      background: '#ffffff', borderRadius: borderRadius, padding: 22,
                      border: selectedSectionId === 'registration_form' && workspaceMode === 'build' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.05)', cursor: 'pointer', position: 'sticky', top: 12
                    }}
                  >
                    <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                      {formCardTitle || 'Register for the Event'}
                    </h3>
                    <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {fieldsConfig.map((f) => (
                        <div key={f.id}>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                            {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                          </label>
                          {f.type === 'dropdown' ? (
                            <select
                              onFocus={() => setFocusedFieldId(f.id)}
                              onBlur={() => setFocusedFieldId(null)}
                              style={{
                                width: '100%', padding: '7px 10px', borderRadius: 6,
                                border: focusedFieldId === f.id ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                                boxShadow: focusedFieldId === f.id ? `0 0 0 3px ${primaryColor}30` : 'none',
                                fontSize: '0.78rem', outline: 'none', transition: 'all 0.2s ease', background: '#fff'
                              }}
                            >
                              <option value="">Select option…</option>
                              {(f.options || []).map((opt, oIdx) => (
                                <option key={oIdx} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder={f.placeholder || ''}
                              onFocus={() => setFocusedFieldId(f.id)}
                              onBlur={() => setFocusedFieldId(null)}
                              style={{
                                width: '100%', padding: '7px 10px', borderRadius: 6,
                                border: focusedFieldId === f.id ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                                boxShadow: focusedFieldId === f.id ? `0 0 0 3px ${primaryColor}30` : 'none',
                                fontSize: '0.78rem', outline: 'none', transition: 'all 0.2s ease'
                              }}
                            />
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        style={{
                          width: '100%', padding: '9px', borderRadius: borderRadius, border: 'none',
                          background: primaryColor, color: '#ffffff', fontWeight: 800, fontSize: '0.82rem',
                          cursor: 'pointer', marginTop: 4
                        }}
                      >
                        {submitBtnText} →
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}

            {/* RICH FOOTER WITH SOCIAL LINKS */}
            <div
              onClick={() => { setSelectedSectionId('footer'); setWorkspaceMode('build'); }}
              style={{
                padding: '20px 24px', background: '#0f172a', color: '#94a3b8',
                borderTop: '1px solid #334155', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', fontSize: '0.78rem', cursor: 'pointer',
                border: selectedSectionId === 'footer' && workspaceMode === 'build' ? '2px solid #4f46e5' : 'none'
              }}
            >
              <div>
                <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem' }}>{brandName}</div>
                <div style={{ marginTop: 2 }}>{copyrightText} • <a href={privacyUrl} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>Privacy Policy</a></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {linkedinUrl && <a href={linkedinUrl} target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}><LinkedinIcon size={16} /></a>}
                {twitterUrl && <a href={twitterUrl} target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}><TwitterIcon size={16} /></a>}
                {youtubeUrl && <a href={youtubeUrl} target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}><YoutubeIcon size={16} /></a>}
                {websiteUrl && <a href={websiteUrl} target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}><Globe size={16} /></a>}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default FormBuilderPage;
