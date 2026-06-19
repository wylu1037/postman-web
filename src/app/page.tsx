'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Braces,
  KeyRound,
  LockKeyhole,
  Play,
  RotateCcw,
  Send,
  ShieldCheck
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
  'border-stone-300 bg-white text-stone-950 shadow-none focus-visible:border-stone-950 focus-visible:ring-2 focus-visible:ring-amber-200';

const segmentedListClass = 'h-full w-full bg-transparent p-1 text-stone-600';

const segmentedTriggerClass =
  'h-full flex-1 rounded-sm text-sm font-medium after:hidden data-[state=active]:bg-white data-[state=active]:text-stone-950 data-[state=active]:shadow-sm';

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
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function CodePanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      <ScrollArea className="code-panel">
        <pre>{value || ' '}</pre>
      </ScrollArea>
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
        : '尚未生成请求',
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
    <main className="min-h-dvh px-4 py-5 text-stone-950 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-375 gap-5">
        <header className="flex flex-col gap-4 border-stone-300/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white/70 px-3 py-1 text-xs font-medium text-stone-600">
              <ShieldCheck className="size-3.5" /> API Gateway AK/SK
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">
              postman-web
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              构造网关可验签的 HTTP 请求，按加密后的最终 body 生成签名。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
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
              onClick={form.handleSubmit(onBuild)}
            >
              <Braces className="size-4" /> 生成
            </Button>
            <Button
              type="button"
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
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(360px,0.9fr)_minmax(420px,1.15fr)]">
          <form
            className="panel grid content-start gap-5 rounded-lg p-4 md:p-5"
            onSubmit={form.handleSubmit(onSend)}
          >
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <Send className="size-4 text-stone-500" />
              <h2 className="text-base font-semibold">请求</h2>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <Field label="Method">
                <Select
                  value={values.method}
                  onValueChange={(method: FormValues['method']) =>
                    form.setValue('method', method)
                  }
                >
                  <SelectTrigger className={controlClass + ' w-full'}>
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
                <Input className={controlClass} {...form.register('url')} />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="X-Token"
                error={form.formState.errors.token?.message}
              >
                <Input className={controlClass} {...form.register('token')} />
              </Field>
              <Field
                label="X-Order-Id"
                error={form.formState.errors.orderId?.message}
              >
                <Input className={controlClass} {...form.register('orderId')} />
              </Field>
            </div>
            <Field
              label="X-Resource-Id"
              error={form.formState.errors.resourceId?.message}
            >
              <Input
                className={controlClass}
                {...form.register('resourceId')}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="AK" error={form.formState.errors.ak?.message}>
                <Input
                  className={controlClass}
                  {...form.register('ak')}
                  autoComplete="off"
                />
              </Field>
              <Field label="SK" error={form.formState.errors.sk?.message}>
                <Input
                  className={controlClass}
                  {...form.register('sk')}
                  type="password"
                  autoComplete="off"
                />
              </Field>
            </div>
            <Field label="额外 Header">
              <Textarea
                className={controlClass + ' min-h-20'}
                {...form.register('extraHeadersText')}
              />
            </Field>
            <Field label="Body">
              <Textarea
                className={controlClass + ' min-h-64'}
                {...form.register('body')}
                spellCheck={false}
              />
            </Field>
          </form>
          <section className="panel grid content-start gap-5 rounded-lg p-4 md:p-5">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <LockKeyhole className="size-4 text-stone-500" />
              <h2 className="text-base font-semibold">加密</h2>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-stone-300 bg-white px-3 py-3 text-sm">
              <span className="font-medium text-stone-800">启用请求加密</span>
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
                <div className="segmented-control h-10 rounded-md border border-stone-300 bg-stone-100">
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
                <div className="segmented-control h-10 rounded-md border border-stone-300 bg-stone-100">
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
                <p className="text-xs text-amber-800">
                  RSA+SM4 字段加密不可用，已由网关拒绝。
                </p>
              ) : null}
            </Field>
            {values.cryptoAlgorithm === 'SM4' ? (
              <Field label="SM4 Key Base64">
                <Input
                  className={controlClass}
                  {...form.register('sm4KeyBase64')}
                  placeholder="16 字节密钥的 Base64"
                />
              </Field>
            ) : (
              <Field label="RSA Public Key PEM">
                <Textarea
                  className={controlClass + ' min-h-48'}
                  {...form.register('rsaPublicKeyPem')}
                  spellCheck={false}
                />
              </Field>
            )}
            {values.cryptoScope === 'FIELD' &&
            values.cryptoAlgorithm === 'SM4' ? (
              <Field label="字段路径">
                <Textarea
                  className={controlClass + ' min-h-28'}
                  {...form.register('fieldPathsText')}
                  spellCheck={false}
                />
              </Field>
            ) : null}
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-950">
              签名覆盖 method、path、query、AK、timestamp、nonce 和最终 body
              hash。
            </div>
          </section>
          <section className="grid gap-5">
            <div className="panel grid gap-4 rounded-lg p-4 md:p-5">
              <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
                <KeyRound className="size-4 text-stone-500" />
                <h2 className="text-base font-semibold">生成结果</h2>
              </div>
              <CodePanel title="Final Request" value={finalPreview} />
              <CodePanel
                title="CanonicalRequest"
                value={built?.debug.canonicalRequest ?? ''}
              />
              <CodePanel
                title="StringToSign"
                value={built?.debug.stringToSign ?? ''}
              />
            </div>
            <div className="panel grid gap-4 rounded-lg p-4 md:p-5">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <h2 className="text-base font-semibold">响应</h2>
                {response ? (
                  <span className="rounded border border-stone-300 bg-white px-2 py-1 font-mono text-xs text-stone-700">
                    {response.status}
                  </span>
                ) : null}
              </div>
              <CodePanel
                title="Headers"
                value={response ? jsonBlock(response.headers) : ''}
              />
              <CodePanel title="Body" value={response?.body ?? ''} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
