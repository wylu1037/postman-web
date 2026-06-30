'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  AlertTriangle,
  Braces,
  Copy,
  Fingerprint,
  Info,
  KeyRound,
  LockKeyhole,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Send,
  Terminal,
  UnlockKeyhole
} from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  buildGatewayRequest,
  type BuiltGatewayRequest
} from '@/lib/http/request-builder';
import { decryptResponseBody } from '@/lib/crypto/body-decryption';

const extraHeaderSchema = z.object({
  key: z.string(),
  value: z.string()
});

const formSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  ak: z.string().min(1),
  sk: z.string().min(1),
  token: z.string().min(1),
  orderId: z.string().min(1),
  resourceId: z.string().min(1),
  body: z.string(),
  extraHeaders: z.array(extraHeaderSchema),
  cryptoEnabled: z.boolean(),
  cryptoAlgorithm: z.enum(['SM4', 'RSA_SM4']),
  cryptoScope: z.enum(['WHOLE', 'FIELD']),
  sm4KeyBase64: z.string(),
  rsaPublicKeyPem: z.string(),
  fieldPathsText: z.string()
});

type FormValues = z.infer<typeof formSchema>;

type ResponseState = {
  status: string;
  headers: Record<string, string>;
  body: string;
};

type JsonViewMode = 'formatted' | 'tree';

const defaults: FormValues = {
  url: 'http://api-test2.datanet.bj.cn/api-gateway/apiHub?page=1&size=10&status=online',
  method: 'GET',
  ak: 'AKX24jiHfJOAbrNJX0br78sU',
  sk: 'U60Y70y6wtw6nL77CokuotlG6bjZFcTATkONaZzVhmC',
  token: '923c3ba836e9b90f',
  orderId: '202606171781687473649',
  resourceId: 'fae2fbb1a21e1c61c163f63d582f2968',
  body: '{\n  "mobile": "13800000000",\n  "name": "wenyang"\n}',
  extraHeaders: [{ key: 'Content-Type', value: 'application/json' }],
  cryptoEnabled: true,
  cryptoAlgorithm: 'SM4',
  cryptoScope: 'WHOLE',
  sm4KeyBase64: '/oceR5WuUPLesWZPl9GbBg==',
  rsaPublicKeyPem: '',
  fieldPathsText: 'mobile\nname'
};

const controlClass =
  'app-control border-zinc-300/90 bg-white/90 text-zinc-950 shadow-none placeholder:text-zinc-400 focus-visible:border-[#4f6f52] focus-visible:ring-[rgba(79,111,82,0.22)]';

const monoControlClass = controlClass + ' app-control-mono';

const segmentedListClass = 'h-full w-full bg-transparent p-0.5 text-zinc-500';

const segmentedTriggerClass =
  'h-full flex-1 rounded-[5px] bg-transparent text-[12.5px] font-semibold text-zinc-500 after:hidden data-[state=active]:bg-transparent data-[state=active]:text-zinc-950 data-[state=active]:shadow-none disabled:text-zinc-400 disabled:opacity-70';

const headerActionButtonClass =
  'header-action-button min-w-16 gap-1.5 sm:w-auto [&_svg]:size-3.5';

function jsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseJson(value: string):
  | {
      ok: true;
      parsed: unknown;
      formatted: string;
    }
  | {
      ok: false;
      formatted: string;
    } {
  try {
    const parsed = JSON.parse(value) as unknown;
    return { ok: true, parsed, formatted: jsonBlock(parsed) };
  } catch {
    return { ok: false, formatted: value };
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonNodeSummary(value: unknown): string {
  if (Array.isArray(value)) return String(value.length) + ' items';
  if (isJsonObject(value)) return String(Object.keys(value).length) + ' keys';
  if (value === null) return 'null';
  return typeof value;
}

function jsonPrimitiveClass(value: unknown): string {
  if (value === null) return 'json-token-null';
  switch (typeof value) {
    case 'string':
      return 'json-token-string';
    case 'number':
      return 'json-token-number';
    case 'boolean':
      return 'json-token-boolean';
    default:
      return 'json-token-null';
  }
}

function formatJsonPrimitive(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function buildCurlCommand(request: BuiltGatewayRequest): string {
  const lines = [
    'curl --request ' + request.method,
    '  --url ' + shellQuote(request.url)
  ];

  for (const [key, value] of Object.entries(request.headers)) {
    lines.push('  --header ' + shellQuote(key + ': ' + value));
  }

  if (
    request.bodyText &&
    request.method !== 'GET' &&
    request.method !== 'HEAD'
  ) {
    lines.push('  --data-raw ' + shellQuote(request.bodyText));
  }

  return lines
    .map((line, index) => (index === lines.length - 1 ? line : line + ' \\'))
    .join('\n');
}

function Field({
  label,
  error,
  hint,
  children
}: {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-end justify-between gap-3">
        <Label className="form-label">{label}</Label>
        {hint ? <span className="form-hint">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="panel-title flex items-center gap-2 pb-1">
      <span className="shrink-0 text-zinc-500">{icon}</span>
      <h2 className="panel-heading min-w-0 flex-1 tracking-tight text-zinc-950">
        {title}
      </h2>
    </div>
  );
}

function StatusPill({
  label,
  value,
  live = false
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <span className="status-pill inline-flex min-h-8 items-center gap-2 rounded-md border border-zinc-200/80 bg-white/75 px-2.5 py-1 text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
      {live ? <span className="status-dot" aria-hidden="true" /> : null}
      <span>{label}</span>
      <span className="font-mono font-semibold text-zinc-900">{value}</span>
    </span>
  );
}

function CodePanel({
  title,
  value,
  emptyText = '等待生成',
  motionKey = ''
}: {
  title: string;
  value: string;
  emptyText?: string;
  motionKey?: string;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <section className="code-module grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="module-heading text-zinc-800">{title}</h3>
        <span className="module-status font-mono text-zinc-500">
          {hasValue ? 'ready' : 'idle'}
        </span>
      </div>
      <div
        key={motionKey + title + String(hasValue)}
        className={'code-shell' + (hasValue ? ' code-shell-ready' : '')}
      >
        <ScrollArea
          className={'code-panel' + (hasValue ? '' : ' code-panel-empty')}
        >
          <pre>{hasValue ? value : emptyText}</pre>
        </ScrollArea>
      </div>
    </section>
  );
}

function JsonTree({
  label = 'root',
  value,
  depth = 0
}: {
  label?: string;
  value: unknown;
  depth?: number;
}) {
  const left = depth * 14;

  if (Array.isArray(value) || isJsonObject(value)) {
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value);

    return (
      <details className="json-tree-node" open={depth < 2}>
        <summary className="json-tree-summary" style={{ paddingLeft: left }}>
          <span className="json-tree-key">{label}</span>
          <span className="json-tree-meta">{jsonNodeSummary(value)}</span>
        </summary>
        <div className="json-tree-children">
          {entries.length > 0 ? (
            entries.map(([key, item]) => (
              <JsonTree key={key} label={key} value={item} depth={depth + 1} />
            ))
          ) : (
            <div className="json-tree-empty" style={{ paddingLeft: left + 14 }}>
              empty {Array.isArray(value) ? 'array' : 'object'}
            </div>
          )}
        </div>
      </details>
    );
  }

  return (
    <div className="json-tree-leaf" style={{ paddingLeft: left }}>
      <span className="json-tree-key">{label}</span>
      <span className={jsonPrimitiveClass(value)}>
        {formatJsonPrimitive(value)}
      </span>
    </div>
  );
}

function JsonPanel({
  title,
  value,
  emptyText = '等待生成',
  motionKey = '',
  action,
  statusLabel
}: {
  title: string;
  value: string;
  emptyText?: string;
  motionKey?: string;
  action?: React.ReactNode;
  statusLabel?: string;
}) {
  const [mode, setMode] = useState<JsonViewMode>('formatted');
  const hasValue = value.trim().length > 0;
  const parsed = useMemo(
    () => (hasValue ? parseJson(value) : null),
    [hasValue, value]
  );
  const isJson = parsed?.ok === true;
  const showTree = isJson && mode === 'tree';
  const displayValue = parsed?.formatted ?? '';

  return (
    <section className="code-module grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="module-heading text-zinc-800">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="module-status font-mono text-zinc-500">
            {statusLabel ?? (hasValue ? (isJson ? 'json' : 'text') : 'idle')}
          </span>
          {isJson ? (
            <div className="json-view-switch inline-flex rounded-md border border-[#c8d6c5] bg-[#eef3ed] p-0.5">
              <button
                type="button"
                className="json-view-button"
                data-active={mode === 'formatted'}
                onClick={() => setMode('formatted')}
              >
                格式化
              </button>
              <button
                type="button"
                className="json-view-button"
                data-active={mode === 'tree'}
                onClick={() => setMode('tree')}
              >
                树形
              </button>
            </div>
          ) : null}
          {action}
        </div>
      </div>
      <div
        key={motionKey + title + String(hasValue)}
        className={'code-shell' + (hasValue ? ' code-shell-ready' : '')}
      >
        <ScrollArea
          className={
            'code-panel' +
            (hasValue ? '' : ' code-panel-empty') +
            (showTree ? ' json-tree-panel' : '')
          }
        >
          {showTree && parsed?.ok ? (
            <div className="json-tree">
              <JsonTree value={parsed.parsed} />
            </div>
          ) : (
            <pre>{hasValue ? displayValue : emptyText}</pre>
          )}
        </ScrollArea>
      </div>
    </section>
  );
}

export default function Home() {
  const [built, setBuilt] = useState<BuiltGatewayRequest | null>(null);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [buildSerial, setBuildSerial] = useState(0);
  const [responseSerial, setResponseSerial] = useState(0);
  const [curlDialogOpen, setCurlDialogOpen] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [responseDecryptStatus, setResponseDecryptStatus] = useState<
    string | null
  >(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults
  });
  const {
    fields: extraHeaderFields,
    append: appendExtraHeader,
    remove: removeExtraHeader
  } = useFieldArray({
    control: form.control,
    name: 'extraHeaders'
  });
  const values = form.watch();
  const rsaFieldUnavailable =
    values.cryptoAlgorithm === 'RSA_SM4' && values.cryptoScope === 'FIELD';
  const finalPreview = useMemo(
    () =>
      built
        ? jsonBlock({
            method: built.method,
            url: built.url,
            headers: built.headers,
            body: built.bodyText
          })
        : '',
    [built]
  );
  const curlCommand = useMemo(
    () => (built ? buildCurlCommand(built) : ''),
    [built]
  );

  async function build(values: FormValues) {
    setError(null);
    setResponse(null);
    setResponseDecryptStatus(null);
    const next = await buildGatewayRequest({
      method: values.method,
      url: values.url,
      ak: values.ak,
      sk: values.sk,
      token: values.token,
      orderId: values.orderId,
      resourceId: values.resourceId,
      body: values.body,
      extraHeaders: values.extraHeaders,
      crypto: {
        enabled: values.cryptoEnabled,
        algorithm: values.cryptoAlgorithm,
        scope: values.cryptoScope,
        sm4KeyBase64: values.sm4KeyBase64,
        rsaPublicKeyPem: values.rsaPublicKeyPem,
        fieldPaths: values.fieldPathsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean)
      }
    });
    setBuilt(next);
    setBuildSerial((serial) => serial + 1);
    return next;
  }

  async function onBuild(values: FormValues) {
    try {
      await build(values);
    } catch (err) {
      setBuilt(null);
      setError(err instanceof Error ? err.message : '构造请求失败');
    }
  }

  async function onCurl(values: FormValues) {
    try {
      setCurlCopied(false);
      await build(values);
      setCurlDialogOpen(true);
    } catch (err) {
      setBuilt(null);
      setError(err instanceof Error ? err.message : '生成 curl 失败');
    }
  }

  async function onSend(values: FormValues) {
    try {
      setIsSending(true);
      const next = await build(values);
      const init: RequestInit = { method: next.method, headers: next.headers };
      if (next.method !== 'GET' && next.method !== 'HEAD')
        init.body = next.bodyText;
      const res = await fetch(next.url, init);
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      setResponse({
        status: String(res.status) + ' ' + res.statusText,
        headers,
        body: await res.text()
      });
      setResponseDecryptStatus(null);
      setResponseSerial((serial) => serial + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求发送失败');
    } finally {
      setIsSending(false);
    }
  }

  async function onCopyCurl() {
    if (!curlCommand) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setError('当前浏览器不支持复制到剪贴板');
      return;
    }
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCurlCopied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '复制 curl 失败');
    }
  }

  function onDecryptResponseBody() {
    if (!response?.body) return;

    try {
      const decrypted = decryptResponseBody(response.body, values.sm4KeyBase64);
      setResponse({
        ...response,
        body: decrypted.bodyText
      });
      setResponseDecryptStatus(
        decrypted.decryptedCount > 1
          ? '已解密 ' + decrypted.decryptedCount + ' 处'
          : '已解密'
      );
      setResponseSerial((serial) => serial + 1);
      setError(null);
    } catch (err) {
      setResponseDecryptStatus(null);
      setError(err instanceof Error ? err.message : '响应 body 解密失败');
    }
  }

  return (
    <main className="workbench relative min-h-dvh w-full max-w-full overflow-x-hidden px-3 py-4 text-zinc-950 sm:px-5 md:py-5 lg:px-8">
      <div className="mx-auto grid max-w-375 gap-5">
        <header className="motion-rise grid gap-4 pb-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="nav-chip inline-flex items-center gap-2 rounded-md border border-zinc-200/90 bg-white/75 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <Fingerprint className="size-3.5 text-[#4f6f52]" />
              API Gateway AK/SK
            </div>
            <h1 className="headline-reveal mt-3 max-w-5xl text-3xl font-semibold tracking-tight text-balance text-zinc-950 md:text-5xl">
              postman
              <span
                aria-hidden="true"
                className="inline-visual mx-2 inline-block h-7 w-20 align-middle md:h-9 md:w-28"
              />
              web
            </h1>
            <p className="scrub-copy mt-2 max-w-[62ch] text-sm leading-6 text-zinc-600">
              加密后签名，生成可发送的网关请求。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label="Method" value={values.method} />
              <StatusPill
                label="Crypto"
                value={
                  values.cryptoEnabled
                    ? values.cryptoAlgorithm.replace('_', '+')
                    : 'OFF'
                }
              />
              <StatusPill
                label="Output"
                value={built ? 'READY' : 'IDLE'}
                live={Boolean(built)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end lg:pb-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className={headerActionButtonClass}
              onClick={() => {
                form.reset(defaults);
                setBuilt(null);
                setResponse(null);
                setError(null);
                setResponseDecryptStatus(null);
                setCurlDialogOpen(false);
                setCurlCopied(false);
              }}
            >
              <RotateCcw /> 重置
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className={headerActionButtonClass}
              onClick={form.handleSubmit(onBuild)}
            >
              <Braces /> 生成
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className={headerActionButtonClass}
              onClick={form.handleSubmit(onCurl)}
            >
              <Terminal /> curl
            </Button>
            <Button
              type="button"
              size="xs"
              className={headerActionButtonClass}
              onClick={form.handleSubmit(onSend)}
              disabled={isSending}
            >
              {isSending ? <Play className="animate-pulse" /> : <Send />} 发送
            </Button>
          </div>
        </header>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}
        <div className="grid grid-flow-dense items-start gap-5 xl:grid-cols-[minmax(340px,0.95fr)_minmax(320px,0.82fr)_minmax(420px,1.18fr)]">
          <form
            className="panel motion-panel interactive-panel static-panel grid content-start gap-5 rounded-lg p-4 md:p-5"
            onSubmit={form.handleSubmit(onSend)}
          >
            <PanelTitle icon={<Send className="size-4" />} title="请求" />
            <div className="grid gap-3 sm:grid-cols-[116px_minmax(0,1fr)]">
              <Field label="Method">
                <Select
                  value={values.method}
                  onValueChange={(method: FormValues['method']) =>
                    form.setValue('method', method)
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className={monoControlClass + ' w-full'}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="bg-white">
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="URL" error={form.formState.errors.url?.message}>
                <Input
                  className={monoControlClass}
                  {...form.register('url')}
                  spellCheck={false}
                />
              </Field>
            </div>
            <div className="grid gap-4">
              <Field
                label="X-Token"
                error={form.formState.errors.token?.message}
              >
                <Input
                  className={monoControlClass}
                  {...form.register('token')}
                  spellCheck={false}
                />
              </Field>
              <Field
                label="X-Order-Id"
                error={form.formState.errors.orderId?.message}
              >
                <Input
                  className={monoControlClass}
                  {...form.register('orderId')}
                  spellCheck={false}
                />
              </Field>
            </div>
            <Field
              label="X-Resource-Id"
              error={form.formState.errors.resourceId?.message}
            >
              <Input
                className={monoControlClass}
                {...form.register('resourceId')}
                spellCheck={false}
              />
            </Field>
            <div className="grid gap-4">
              <Field label="AK" error={form.formState.errors.ak?.message}>
                <Input
                  className={monoControlClass}
                  {...form.register('ak')}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field label="SK" error={form.formState.errors.sk?.message}>
                <Input
                  className={monoControlClass}
                  {...form.register('sk')}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>
            <Field label="额外 Header">
              <div className="grid gap-2">
                <div className="extra-header-toolbar">
                  {extraHeaderFields.length > 0 ? (
                    <div className="extra-header-grid-labels hidden flex-1 grid-cols-[minmax(0,0.88fr)_minmax(0,1fr)_2.25rem] gap-2 px-2 sm:grid">
                      <span>Key</span>
                      <span>Value</span>
                      <span className="sr-only">操作</span>
                    </div>
                  ) : (
                    <span className="extra-header-grid-labels text-zinc-500">
                      Key / Value
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="micro-action-button extra-header-add-button gap-1 [&_svg]:size-3"
                    onClick={() => appendExtraHeader({ key: '', value: '' })}
                  >
                    <Plus /> 添加
                  </Button>
                </div>
                {extraHeaderFields.length > 0 ? (
                  extraHeaderFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="extra-header-row grid gap-2 rounded-md border border-zinc-200 bg-white/65 p-2 sm:grid-cols-[minmax(0,0.88fr)_minmax(0,1fr)_2.25rem] sm:items-end"
                    >
                      <div className="grid gap-1.5">
                        <Label
                          htmlFor={'extra-header-key-' + field.id}
                          className="extra-header-mobile-label sm:sr-only"
                        >
                          Key
                        </Label>
                        <Input
                          id={'extra-header-key-' + field.id}
                          className={monoControlClass}
                          {...form.register(`extraHeaders.${index}.key`)}
                          placeholder="Header 名称"
                          spellCheck={false}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label
                          htmlFor={'extra-header-value-' + field.id}
                          className="extra-header-mobile-label sm:sr-only"
                        >
                          Value
                        </Label>
                        <Input
                          id={'extra-header-value-' + field.id}
                          className={monoControlClass}
                          {...form.register(`extraHeaders.${index}.value`)}
                          placeholder="Header 值"
                          spellCheck={false}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className="header-remove-button self-end border-zinc-200 bg-white text-zinc-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        aria-label={'移除 Header ' + String(index + 1)}
                        onClick={() => removeExtraHeader(index)}
                      >
                        <Minus />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="empty-row rounded-md border border-dashed border-zinc-300 bg-white/55 px-3 py-4 text-zinc-500">
                    暂无额外 Header
                  </div>
                )}
              </div>
            </Field>
            {values.method !== 'GET' ? (
              <Field label="Body">
                <Textarea
                  className={monoControlClass + ' min-h-64'}
                  {...form.register('body')}
                  spellCheck={false}
                />
              </Field>
            ) : null}
          </form>
          <section className="panel motion-panel interactive-panel static-panel motion-delay-1 grid content-start gap-5 rounded-lg p-4 md:p-5">
            <PanelTitle
              icon={<LockKeyhole className="size-4" />}
              title="加密"
            />
            <div className="control-card flex min-h-10 items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white/80 px-3 py-2 transition-[border-color,background-color] duration-200 hover:border-[#4f6f52]/35">
              <div className="flex min-w-0 items-center gap-2">
                <Label
                  htmlFor="crypto-enabled"
                  className="control-card-label cursor-pointer text-zinc-800"
                >
                  请求加密
                </Label>
                <button
                  type="button"
                  className="tooltip-trigger"
                  data-tooltip={
                    values.cryptoEnabled ? '参与请求构造' : '明文请求'
                  }
                  aria-label={
                    values.cryptoEnabled ? '参与请求构造' : '明文请求'
                  }
                >
                  <Info className="size-3.5" />
                </button>
              </div>
              <Switch
                id="crypto-enabled"
                checked={values.cryptoEnabled}
                onCheckedChange={(checked) =>
                  form.setValue('cryptoEnabled', checked)
                }
              />
            </div>
            <Field label="算法">
              <Tabs
                value={values.cryptoAlgorithm}
                onValueChange={(algorithm) => {
                  const nextAlgorithm =
                    algorithm as FormValues['cryptoAlgorithm'];
                  form.setValue('cryptoAlgorithm', nextAlgorithm);
                  if (
                    nextAlgorithm === 'RSA_SM4' &&
                    values.cryptoScope === 'FIELD'
                  )
                    form.setValue('cryptoScope', 'WHOLE');
                }}
              >
                <div
                  className="segmented-control h-10 rounded-md border border-zinc-300/90 bg-zinc-100/80"
                  data-active-index={
                    values.cryptoAlgorithm === 'RSA_SM4' ? 1 : 0
                  }
                >
                  <TabsList className={segmentedListClass}>
                    <TabsTrigger className={segmentedTriggerClass} value="SM4">
                      SM4
                    </TabsTrigger>
                    <TabsTrigger
                      className={segmentedTriggerClass}
                      value="RSA_SM4"
                    >
                      RSA+SM4
                    </TabsTrigger>
                  </TabsList>
                </div>
              </Tabs>
            </Field>
            <Field label="范围">
              <Tabs
                value={values.cryptoScope}
                onValueChange={(scope) =>
                  form.setValue(
                    'cryptoScope',
                    scope as FormValues['cryptoScope']
                  )
                }
              >
                <div
                  className="segmented-control h-10 rounded-md border border-zinc-300/90 bg-zinc-100/80"
                  data-active-index={values.cryptoScope === 'FIELD' ? 1 : 0}
                >
                  <TabsList className={segmentedListClass}>
                    <TabsTrigger
                      className={segmentedTriggerClass}
                      value="WHOLE"
                    >
                      整体加密
                    </TabsTrigger>
                    <TabsTrigger
                      className={segmentedTriggerClass}
                      value="FIELD"
                      disabled={values.cryptoAlgorithm === 'RSA_SM4'}
                    >
                      字段加密
                    </TabsTrigger>
                  </TabsList>
                </div>
              </Tabs>
              {rsaFieldUnavailable ? (
                <p className="text-xs text-[#6f4e16]">
                  RSA+SM4 字段加密不可用，已由网关拒绝。
                </p>
              ) : null}
            </Field>
            {values.cryptoAlgorithm === 'SM4' ? (
              <Field label="SM4 Key Base64">
                <Input
                  className={monoControlClass}
                  {...form.register('sm4KeyBase64')}
                  placeholder="16 字节密钥的 Base64"
                  spellCheck={false}
                />
              </Field>
            ) : (
              <Field label="RSA Public Key PEM">
                <Textarea
                  className={monoControlClass + ' min-h-48'}
                  {...form.register('rsaPublicKeyPem')}
                  spellCheck={false}
                />
              </Field>
            )}
            {values.cryptoScope === 'FIELD' &&
            values.cryptoAlgorithm === 'SM4' ? (
              <Field label="字段路径">
                <Textarea
                  className={monoControlClass + ' min-h-28'}
                  {...form.register('fieldPathsText')}
                  spellCheck={false}
                />
              </Field>
            ) : null}
            <div className="utility-note rounded-md border border-[#4f6f52]/20 bg-[#edf4ec] px-3 py-3 text-[#2f3f31]">
              签名覆盖 method、path、query、AK、timestamp、nonce 和最终 body
              hash。
            </div>
          </section>
          <section className="output-stack grid gap-5">
            <div className="panel stack-card motion-panel interactive-panel static-panel motion-delay-2 grid gap-4 rounded-lg p-4 md:p-5">
              <PanelTitle
                icon={<KeyRound className="size-4" />}
                title="生成结果"
              />
              <JsonPanel
                title="Final Request"
                value={finalPreview}
                emptyText="生成后显示 method、url、headers 与最终 body"
                motionKey={String(buildSerial)}
              />
              <CodePanel
                title="CanonicalRequest"
                value={built?.debug.canonicalRequest ?? ''}
                emptyText="等待请求签名材料"
                motionKey={String(buildSerial)}
              />
              <CodePanel
                title="StringToSign"
                value={built?.debug.stringToSign ?? ''}
                emptyText="等待 canonical hash"
                motionKey={String(buildSerial)}
              />
            </div>
            <div
              className={
                'panel stack-card motion-panel interactive-panel static-panel motion-delay-3 grid gap-4 rounded-lg p-4 md:p-5' +
                (isSending ? ' panel-busy' : '')
              }
            >
              <div className="flex items-start justify-between gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-zinc-500" />
                  <h2 className="panel-heading tracking-tight">响应</h2>
                </div>
                {response ? (
                  <span className="response-status rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-zinc-700">
                    {response.status}
                  </span>
                ) : null}
              </div>
              <CodePanel
                title="Headers"
                value={response ? jsonBlock(response.headers) : ''}
                emptyText="发送后显示响应 headers"
                motionKey={String(responseSerial)}
              />
              <JsonPanel
                title="Body"
                value={response?.body ?? ''}
                emptyText="发送后显示响应 body"
                motionKey={String(responseSerial)}
                statusLabel={responseDecryptStatus ?? undefined}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="micro-action-button gap-1 [&_svg]:size-3"
                    onClick={onDecryptResponseBody}
                    disabled={!response?.body}
                  >
                    <UnlockKeyhole /> 解密
                  </Button>
                }
              />
            </div>
          </section>
        </div>
      </div>
      <Dialog
        open={curlDialogOpen}
        onOpenChange={(open) => {
          setCurlDialogOpen(open);
          if (!open) setCurlCopied(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>curl 命令</DialogTitle>
          </DialogHeader>
          <div
            key={curlCommand}
            className={'code-shell' + (curlCommand ? ' code-shell-ready' : '')}
          >
            <ScrollArea
              className={
                'code-panel curl-code-panel' +
                (curlCommand ? '' : ' code-panel-empty')
              }
            >
              <pre>{curlCommand || '等待生成 curl'}</pre>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className={headerActionButtonClass}
              onClick={onCopyCurl}
              disabled={!curlCommand}
            >
              <Copy /> {curlCopied ? '已复制' : '复制'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
