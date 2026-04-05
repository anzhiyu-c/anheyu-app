/**
 * KaTeX 类型声明
 */

declare module "katex/contrib/auto-render" {
  interface RenderMathInElementOptions {
    delimiters?: Array<{
      left: string;
      right: string;
      display: boolean;
    }>;
    ignoredTags?: string[];
    ignoredClasses?: string[];
    errorCallback?: (msg: string, err: Error) => void;
    preProcess?: (math: string) => string;
    throwOnError?: boolean;
    trust?: boolean | ((context: { command: string; url: string; protocol: string }) => boolean);
    strict?: boolean | string | ((errorCode: string, errorMsg: string, token: unknown) => string);
    macros?: Record<string, string>;
  }

  export default function renderMathInElement(element: HTMLElement, options?: RenderMathInElementOptions): void;
}
