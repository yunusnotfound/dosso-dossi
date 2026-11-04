import { InformationPage, informationMetadata } from "@/components/information/information-page";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { return informationMetadata("tr", (await params).slug); }
export default async function Page({ params }: Props) { return <InformationPage locale="tr" slug={(await params).slug} />; }
