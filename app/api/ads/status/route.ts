import { NextResponse } from 'next/server';

const AD_ACCOUNT_ID = process.env.FACEBOOK_AD_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!AD_ACCOUNT_ID || !ACCESS_TOKEN) {
    return NextResponse.json([]);
  }

  try {
    const url = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/campaigns?` + new URLSearchParams({
      access_token: ACCESS_TOKEN,
      fields: 'id,name,status,effective_status,created_time',
      limit: '50'
    });

    const res = await fetch(url, { next: { revalidate: 300 } });
    const data = await res.json();
    
    if (data.error) {
      console.error('Erro Meta Campaigns API:', data.error);
      return NextResponse.json([]);
    }
    
    return NextResponse.json(data.data || []);
  } catch (error) {
    console.error('Erro ao buscar status das campanhas:', error);
    return NextResponse.json([]);
  }
}
