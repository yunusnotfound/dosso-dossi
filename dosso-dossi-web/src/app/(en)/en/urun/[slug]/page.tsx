import { ProductPage, productMetadata } from "@/components/shop/product-page";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { return productMetadata("en", (await params).slug); }
export default async function Page({ params }: Props) { return <ProductPage locale="en" slug={(await params).slug} />; }
