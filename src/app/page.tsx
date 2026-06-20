'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  AlertTriangle,
  Braces,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Play,
  RotateCcw,
  Send
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  buildGatewayRequest,
  type BuiltGatewayRequest,
  type ExtraHeader
} from '@/lib/http/request-builder';

const formSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  ak: z.string().min(1),
  sk: z.string().min(1),
  token: z.string().min(1),
  orderId: z.string().min(1),
  resourceId: z.string().min(1),
  body: z.string(),
  extraHeadersText: z.string(),
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

const defaults: FormValues = {
  url: 'http://localhost:8080/api-gateway/apiHub',
  method: 'POST',
  ak: '',
  sk: '',
  token: '',
  orderId: '',
  resourceId: '',
  body: '{\n  "mobile": "13800000000",\n  "name": "wenyang"\n}',
  extraHeadersText: 'Content-Type: application/json',
  cryptoEnabled: true,
  cryptoAlgorithm: 'SM4',
  cryptoScope: 'WHOLE',
  sm4KeyBase64: '',
  rsaPublicKeyPem: '',
  fieldPathsText: 'mobile\nname'
};

const controlClass =
  'border-zinc-300/90 bg-white/90 text-zinc-950 shadow-none placeholder:text-zinc-400 focus-visible:border-[#4f6f52] focus-visible:ring-[rgba(79,111,82,0.22)]';

const monoControlClass = controlClass + ' font-mono text-[13px] leading-6';

const segmentedListClass = 'h-full w-full bg-transparent p-1 text-zinc-500';

const segmentedTriggerClass =
  'h-full flex-1 rounded-[5px] text-sm font-medium after:hidden data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow-[0_1px_0_rgba(24,24,27,0.08)]';

function parseExtraHeaders(input: string): ExtraHeader[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(':');
      if (index < 0) return { key: line, value: '' };
      return {
        key: line.slice(0, index).trim(),
        value: line.slice(index + 1).trim()
      };
    });
}

function jsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function Field({
  label,
  error,
  hint,
  children
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-end justify-between gap-3">
        <Label className="text-[13px] font-semibold text-zinc-700">
          {label}
        </Label>
        {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PanelTitle({
  step,
  icon,
  title,
  meta
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-zinc-200/80 pb-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-zinc-950 font-mono text-xs font-semibold text-zinc-50">
        {step}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-zinc-950">
          <span className="text-zinc-500">{icon}</span>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{meta}</p>
      </div>
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
    <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-zinc-200/80 bg-white/75 px-2.5 py-1 text-xs text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
      {live ? <span className="status-dot" aria-hidden="true" /> : null}
      <span>{label}</span>
      <span className="font-mono font-semibold text-zinc-900">{value}</span>
    </span>
  );
}

function CodePanel({
  title,
  value,
  emptyText = '等待生成'
}: {
  title: string;
  value: string;
  emptyText?: string;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
        <span className="font-mono text-[11px] text-zinc-500">
          {hasValue ? 'ready' : 'idle'}
        </span>
      </div>
      <div className="code-shell">
        <ScrollArea
          className={'code-panel' + (hasValue ? '' : ' code-panel-empty')}
        >
          <pre>{hasValue ? value : emptyText}</pre>
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
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults
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

  async function build(values: FormValues) {
    setError(null);
    setResponse(null);
    const next = await buildGatewayRequest({
      method: values.method,
      url: values.url,
      ak: values.ak,
      sk: values.sk,
      token: values.token,
      orderId: values.orderId,
      resourceId: values.resourceId,
      body: values.body,
      extraHeaders: parseExtraHeaders(values.extraHeadersText),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求发送失败');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-dvh px-3 py-4 text-zinc-950 sm:px-5 md:py-5 lg:px-8">
      <div className="mx-auto grid max-w-[1500px] gap-5">
        <header className="grid gap-4 border-b border-zinc-300/70 pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200/90 bg-white/75 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <Fingerprint className="size-3.5 text-[#4f6f52]" />
              API Gateway AK/SK
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-zinc-950 md:text-5xl">
              postman-web
            </h1>
            <p className="mt-2 max-w-[62ch] text-sm leading-6 text-zinc-600">
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
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                form.reset(defaults);
                setBuilt(null);
                setResponse(null);
                setError(null);
              }}
            >
              <RotateCcw className="size-4" /> 重置
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={form.handleSubmit(onBuild)}
            >
              <Braces className="size-4" /> 生成
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={form.handleSubmit(onSend)}
              disabled={isSending}
            >
              {isSending ? (
                <Play className="size-4 animate-pulse" />
              ) : (
                <Send className="size-4" />
              )}{' '}
              发送
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
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.95fr)_minmax(320px,0.82fr)_minmax(420px,1.18fr)]">
          <form
            className="panel grid content-start gap-5 rounded-lg p-4 md:p-5"
            onSubmit={form.handleSubmit(onSend)}
          >
            <PanelTitle
              step="01"
              icon={<Send className="size-4" />}
              title="请求"
              meta="路由、认证和原始请求体"
            />
            <div className="grid gap-3 sm:grid-cols-[116px_minmax(0,1fr)]">
              <Field label="Method">
                <Select
                  value={values.method}
                  onValueChange={(method: FormValues['method']) =>
                    form.setValue('method', method)
                  }
                >
                  <SelectTrigger className={monoControlClass + ' w-full'}>
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
            <div className="grid gap-4 md:grid-cols-2">
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
            <div className="grid gap-4 md:grid-cols-2">
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
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>
            <Field label="额外 Header">
              <Textarea
                className={monoControlClass + ' min-h-24'}
                {...form.register('extraHeadersText')}
                spellCheck={false}
              />
            </Field>
            <Field label="Body">
              <Textarea
                className={monoControlClass + ' min-h-64'}
                {...form.register('body')}
                spellCheck={false}
              />
            </Field>
          </form>
          <section className="panel grid content-start gap-5 rounded-lg p-4 md:p-5">
            <PanelTitle
              step="02"
              icon={<LockKeyhole className="size-4" />}
              title="加密"
              meta="SM4、RSA+SM4 和字段范围"
            />
            <label className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white/80 px-3 py-3 text-sm transition-[border-color,background-color] duration-200 hover:border-[#4f6f52]/35">
              <span className="grid gap-0.5">
                <span className="font-medium text-zinc-800">启用请求加密</span>
                <span className="text-xs text-zinc-500">
                  {values.cryptoEnabled ? '参与请求构造' : '明文请求'}
                </span>
              </span>
              <Checkbox
                checked={values.cryptoEnabled}
                onCheckedChange={(checked) =>
                  form.setValue('cryptoEnabled', checked === true)
                }
              />
            </label>
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
                <div className="segmented-control h-11 rounded-md border border-zinc-300/90 bg-zinc-100/80">
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
                <div className="segmented-control h-11 rounded-md border border-zinc-300/90 bg-zinc-100/80">
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
            <div className="rounded-md border border-[#4f6f52]/20 bg-[#edf4ec] px-3 py-3 text-xs leading-5 text-[#2f3f31]">
              签名覆盖 method、path、query、AK、timestamp、nonce 和最终 body
              hash。
            </div>
          </section>
          <section className="grid gap-5">
            <div className="panel grid gap-4 rounded-lg p-4 md:p-5">
              <PanelTitle
                step="03"
                icon={<KeyRound className="size-4" />}
                title="生成结果"
                meta="最终请求、CanonicalRequest 和 StringToSign"
              />
              <CodePanel
                title="Final Request"
                value={finalPreview}
                emptyText="生成后显示 method、url、headers 与最终 body"
              />
              <CodePanel
                title="CanonicalRequest"
                value={built?.debug.canonicalRequest ?? ''}
                emptyText="等待请求签名材料"
              />
              <CodePanel
                title="StringToSign"
                value={built?.debug.stringToSign ?? ''}
                emptyText="等待 canonical hash"
              />
            </div>
            <div className="panel grid gap-4 rounded-lg p-4 md:p-5">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200/80 pb-4">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-zinc-500" />
                  <h2 className="text-base font-semibold tracking-tight">
                    响应
                  </h2>
                </div>
                {response ? (
                  <span className="rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-xs text-zinc-700">
                    {response.status}
                  </span>
                ) : null}
              </div>
              <CodePanel
                title="Headers"
                value={response ? jsonBlock(response.headers) : ''}
                emptyText="发送后显示响应 headers"
              />
              <CodePanel
                title="Body"
                value={response?.body ?? ''}
                emptyText="发送后显示响应 body"
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
