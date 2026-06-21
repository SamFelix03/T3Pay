import Image from "next/image";

type Props = {
  variant?: "nav" | "hero";
  className?: string;
};

export function BrandLogo({ variant = "nav", className = "" }: Props) {
  const isHero = variant === "hero";
  return (
    <Image
      src="/logo.png"
      alt="T3Pay"
      width={isHero ? 200 : 176}
      height={isHero ? 56 : 48}
      className={`brand-logo-image ${isHero ? "hero" : "nav"} ${className}`.trim()}
      priority
    />
  );
}
