import { ArrowLeft, Code2, Image, Link2, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';
import { EmailNav } from './email/EmailNav';

interface TemplateDetail {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
}

function extractVariables(content: string) {
  return Array.from(new Set(Array.from(content.matchAll(/\{\{(\w+)\}\}/g)).map((match) => match[1]).filter(Boolean) as string[])).sort();
}

function buildImageHtml(url: string, alt: string, width: string): string {
  const widthAttr = width ? ` width="${width}"` : '';
  const styleWidth = width ? ` max-width: ${width}px;` : ' max-width: 100%;';
  return `<img src="${url}" alt="${alt}"${widthAttr} style="display: block; height: auto;${styleWidth} border: 0;" />`;
}

function buildButtonHtml(text: string, url: string, bgColor: string, textColor: string): string {
  return (
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 16px 0;">` +
    `<tr>` +
    `<td align="center" style="border-radius: 6px; background-color: ${bgColor};">` +
    `<a href="${url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: ${textColor}; text-decoration: none; border-radius: 6px; background-color: ${bgColor};">${text}</a>` +
    `</td>` +
    `</tr>` +
    `</table>`
  );
}

export default function EmailTemplateEditor() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const isEditing = Boolean(templateId);
  const template = useApiData<TemplateDetail>(templateId ? `/email/templates/${templateId}` : '', [templateId], Boolean(templateId));

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('<p>Hello {{firstName}},</p>');
  const [textContent, setTextContent] = useState('Hello {{firstName}},');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dialog state for image insertion
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageWidth, setImageWidth] = useState('');

  // Dialog state for button/CTA insertion
  const [buttonDialogOpen, setButtonDialogOpen] = useState(false);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonBgColor, setButtonBgColor] = useState('#0EA5E9');
  const [buttonTextColor, setButtonTextColor] = useState('#FFFFFF');

  // Ref for tracking cursor position in HTML textarea
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number | null>(null);

  // Save cursor position whenever the textarea loses focus or selection changes
  const handleHtmlSelect = useCallback(() => {
    if (htmlTextareaRef.current) {
      cursorPositionRef.current = htmlTextareaRef.current.selectionStart;
    }
  }, []);

  const insertAtCursor = useCallback(
    (snippet: string) => {
      const pos = cursorPositionRef.current;
      if (pos !== null && pos >= 0 && pos <= htmlContent.length) {
        const before = htmlContent.slice(0, pos);
        const after = htmlContent.slice(pos);
        setHtmlContent(before + snippet + after);
        // Update cursor position to after the inserted snippet
        cursorPositionRef.current = pos + snippet.length;
      } else {
        // Append at end if no cursor position tracked
        setHtmlContent((prev) => prev + '\n' + snippet);
      }
    },
    [htmlContent]
  );

  useEffect(() => {
    if (!template.data) {
      return;
    }
    setName(template.data.name);
    setSubject(template.data.subject);
    setHtmlContent(template.data.htmlContent);
    setTextContent(template.data.textContent ?? '');
  }, [template.data]);

  const variables = useMemo(
    () => extractVariables([subject, htmlContent, textContent].join('\n')),
    [htmlContent, subject, textContent]
  );

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEditing && templateId) {
        await apiClient.put(`/email/templates/${templateId}`, {
          name,
          subject,
          htmlContent,
          textContent: textContent || undefined,
        });
      } else {
        await apiClient.post('/email/templates', {
          name,
          subject,
          htmlContent,
          textContent: textContent || undefined,
        });
      }
      navigate('/email/templates');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save template.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInsertImage = () => {
    if (!imageUrl.trim()) return;
    const html = buildImageHtml(imageUrl.trim(), imageAlt.trim(), imageWidth.trim());
    insertAtCursor(html);
    setImageDialogOpen(false);
    setImageUrl('');
    setImageAlt('');
    setImageWidth('');
  };

  const handleInsertButton = () => {
    if (!buttonText.trim() || !buttonUrl.trim()) return;
    const html = buildButtonHtml(buttonText.trim(), buttonUrl.trim(), buttonBgColor, buttonTextColor);
    insertAtCursor(html);
    setButtonDialogOpen(false);
    setButtonText('');
    setButtonUrl('');
    setButtonBgColor('#0EA5E9');
    setButtonTextColor('#FFFFFF');
  };

  if (isEditing && template.loading) {
    return <LoadingState label="Loading email template..." />;
  }

  if (template.error) {
    return <ErrorState message={template.error} onRetry={() => void template.reload()} />;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <button onClick={() => navigate('/email/templates')} className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-[#0EA5E9]">
              <ArrowLeft className="h-4 w-4" />
              Back to Templates
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">{isEditing ? 'Edit Email Template' : 'Create Email Template'}</h1>
            </div>
            <EmailNav />
          </div>
          <Button
            className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
            onClick={() => void handleSave()}
            disabled={submitting || !name.trim() || !subject.trim() || !htmlContent.trim()}
          >
            {submitting ? 'Saving...' : isEditing ? 'Save Template' : 'Create Template'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="grid gap-5">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-gray-700">Template Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Quarterly nurture intro" />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-gray-700">Subject Line</span>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Checking in about {{company}}" />
            </label>

            {/* HTML Body with toolbar */}
            <div className="block text-sm">
              <span className="mb-2 block font-medium text-gray-700">HTML Body</span>
              <div className="mb-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setImageDialogOpen(true)}
                >
                  <Image className="h-3.5 w-3.5" />
                  Insert Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setButtonDialogOpen(true)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Insert Button
                </Button>
              </div>
              <Textarea
                ref={htmlTextareaRef}
                value={htmlContent}
                onChange={(event) => setHtmlContent(event.target.value)}
                onSelect={handleHtmlSelect}
                onBlur={handleHtmlSelect}
                onKeyUp={handleHtmlSelect}
                onClick={handleHtmlSelect}
                className="min-h-[260px] font-mono text-sm"
              />
            </div>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-gray-700">Plain Text Body</span>
              <Textarea value={textContent} onChange={(event) => setTextContent(event.target.value)} className="min-h-[180px] font-mono text-sm" />
            </label>
            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#0EA5E9]" />
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Extracted Variables</h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {variables.length === 0 ? (
                <span className="text-sm text-gray-500">Add placeholders like {'{{firstName}}'} or {'{{company}}'}.</span>
              ) : (
                variables.map((variable) => (
                  <span key={variable} className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                    {`{{${variable}}}`}
                  </span>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#0EA5E9]" />
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Preview</h3>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</p>
                <p className="mt-1 text-sm font-medium text-[#1E3A5F]">{subject || 'No subject yet'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">HTML</p>
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
                  <div dangerouslySetInnerHTML={{ __html: htmlContent || '<p>No HTML body yet.</p>' }} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Plain Text</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-200 bg-slate-950 p-4 text-sm text-slate-100">
                  {textContent || 'No plain text body yet.'}
                </pre>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Insert Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>
              Add an image to your email template. Use a publicly accessible URL for the image source.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="image-url">Image URL *</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                type="url"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image-alt">Alt Text</Label>
              <Input
                id="image-alt"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Descriptive text for the image"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image-width">Width (px, optional)</Label>
              <Input
                id="image-width"
                value={imageWidth}
                onChange={(e) => setImageWidth(e.target.value)}
                placeholder="600"
                type="number"
                min="1"
              />
            </div>
            {imageUrl.trim() && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-medium text-gray-500">Preview</p>
                <img
                  src={imageUrl}
                  alt={imageAlt || 'Preview'}
                  style={{ maxWidth: imageWidth ? `${imageWidth}px` : '100%', height: 'auto' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                  onLoad={(e) => {
                    (e.target as HTMLImageElement).style.display = 'block';
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
              onClick={handleInsertImage}
              disabled={!imageUrl.trim()}
            >
              Insert Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insert Button/CTA Dialog */}
      <Dialog open={buttonDialogOpen} onOpenChange={setButtonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Button / CTA</DialogTitle>
            <DialogDescription>
              Add a call-to-action button to your email template. Uses table-based HTML for email client compatibility.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="button-text">Button Text *</Label>
              <Input
                id="button-text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="Learn More"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="button-url">Button URL *</Label>
              <Input
                id="button-url"
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
                placeholder="https://example.com/landing-page"
                type="url"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="button-bg-color">Background Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="button-bg-color"
                    type="color"
                    value={buttonBgColor}
                    onChange={(e) => setButtonBgColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                  />
                  <Input
                    value={buttonBgColor}
                    onChange={(e) => setButtonBgColor(e.target.value)}
                    placeholder="#0EA5E9"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="button-text-color">Text Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="button-text-color"
                    type="color"
                    value={buttonTextColor}
                    onChange={(e) => setButtonTextColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                  />
                  <Input
                    value={buttonTextColor}
                    onChange={(e) => setButtonTextColor(e.target.value)}
                    placeholder="#FFFFFF"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            {buttonText.trim() && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-xs font-medium text-gray-500">Preview</p>
                <div className="flex justify-start">
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '12px 24px',
                      fontFamily: 'Arial, sans-serif',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: buttonTextColor,
                      backgroundColor: buttonBgColor,
                      borderRadius: '6px',
                      textDecoration: 'none',
                    }}
                  >
                    {buttonText}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setButtonDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
              onClick={handleInsertButton}
              disabled={!buttonText.trim() || !buttonUrl.trim()}
            >
              Insert Button
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
