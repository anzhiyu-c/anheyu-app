/**
 * 控制台打印工具
 * 在生产环境中显示品牌 ASCII 艺术和欢迎信息
 */

let hasPrinted = false;

export function printConsoleWelcome() {
  if (hasPrinted) return;
  if (typeof window === "undefined") return;
  hasPrinted = true;

  const fetchVersionAndPrint = async () => {
    let version = "未知版本";

    try {
      const res = await fetch("/api/version", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        if (result.code === 200 && result.data) {
          version = (result.data.version || "").replace(/^v/, "") || "未知版本";
        }
      }
    } catch {
      // 静默处理
    }

    const ascii = `
     █████╗ ███╗   ██╗██╗  ██╗███████╗██╗   ██╗██╗   ██╗
    ██╔══██╗████╗  ██║██║  ██║██╔════╝╚██╗ ██╔╝██║   ██║
    ███████║██╔██╗ ██║███████║█████╗   ╚████╔╝ ██║   ██║
    ██╔══██║██║╚██╗██║██╔══██║██╔══╝    ╚██╔╝  ██║   ██║
    ██║  ██║██║ ╚████║██║  ██║███████╗   ██║   ╚██████╔╝
    ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝`;

    setTimeout(() => {
      console.log(
        `\n%c欢迎使用安知鱼! %c 生活明朗, 万物可爱 %c ${ascii} \n\n%c © AnHeYu V${version}\n`,
        "color:#425AEF;font-weight:bold",
        "",
        "color:#425AEF",
        ""
      );
    }, 100);

    setTimeout(() => {
      console.log(
        `%c NCC2-036 %c 调用前置摄像头拍照成功，识别为【小笨蛋】. %c \n🤪\n`,
        "color:white; background-color:#4fd953; padding:2px 6px; border-radius:3px",
        "",
        ""
      );
    }, 300);

    setTimeout(() => {
      console.log(
        "%c WELCOME %c 你好，小笨蛋.",
        "color:white; background-color:#4f90d9; padding:2px 6px; border-radius:3px",
        ""
      );
    }, 500);

    setTimeout(() => {
      console.warn(
        `%c ⚡ Powered by AnHeYu %c 你正在访问安知鱼的博客.`,
        "color:white; background-color:#f0ad4e; padding:2px 6px; border-radius:3px",
        ""
      );
    }, 700);

    setTimeout(() => {
      console.log(
        "%c W23-12 %c 你已打开控制台.",
        "color:white; background-color:#4f90d9; padding:2px 6px; border-radius:3px",
        ""
      );
    }, 900);

    setTimeout(() => {
      console.warn(
        "%c S013-782 %c 你现在正处于监控中.",
        "color:white; background-color:#d9534f; padding:2px 6px; border-radius:3px",
        ""
      );
    }, 1100);
  };

  setTimeout(fetchVersionAndPrint, 1000);
}
