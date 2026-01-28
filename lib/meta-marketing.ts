/**
 * 📊 META MARKETING API
 * 
 * Busca dados de campanhas de anúncios do Facebook/Instagram
 * para exibir métricas de performance no dashboard admin.
 */

const AD_ACCOUNT_ID = process.env.FACEBOOK_AD_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

export interface CampaignInsight {
  campaign_name: string;
  campaign_id?: string;
  spend: string;
  impressions: string;
  clicks: string;
  cpc: string;
  ctr: string;
  reach: string;
  date_start?: string;
  date_stop?: string;
  outbound_clicks?: Array<{ action_type: string; value: string }>;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
  action_values?: Array<{
    action_type: string;
    value: string;
  }>;
}

export interface AdsMetrics {
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  totalReach: number;
  avgCpc: number;
  avgCtr: number;
  totalVideoViews: number;
  totalOutboundClicks: number;
  totalPurchases: number;
  totalPurchaseValue: number;
  roas: number;
  cpa: number;
  campaigns: CampaignInsight[];
}

// Períodos disponíveis para consulta (compatíveis com Facebook Ads API)
export type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d' | 'this_month' | 'last_month' | 'maximum';

/**
 * Busca insights das campanhas
 */
export async function getAdsInsights(datePreset: DatePreset = 'maximum'): Promise<CampaignInsight[]> {
  if (!AD_ACCOUNT_ID || !ACCESS_TOKEN) {
    console.error('❌ FACEBOOK_AD_ACCOUNT_ID ou FACEBOOK_ACCESS_TOKEN não configurados');
    return [];
  }

  const url = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?` + new URLSearchParams({
    access_token: ACCESS_TOKEN,
    level: 'campaign',
    date_preset: datePreset,
    fields: 'campaign_name,campaign_id,spend,impressions,clicks,cpc,ctr,actions,action_values,reach,date_start,date_stop,outbound_clicks',
    limit: '50'
  });

  try {
    const res = await fetch(url, { next: { revalidate: 300 } }); // Cache 5min
    const data = await res.json();
    
    if (data.error) {
      console.error('❌ Erro na Meta Ads API:', data.error);
      return [];
    }
    
    return data.data || [];
  } catch (error) {
    console.error('💥 Erro ao buscar Ads Insights:', error);
    return [];
  }
}

/**
 * Calcula métricas agregadas das campanhas
 */
export function calculateAdsMetrics(campaigns: CampaignInsight[]): AdsMetrics {
  if (!campaigns.length) {
    return {
      totalSpend: 0,
      totalClicks: 0,
      totalImpressions: 0,
      totalReach: 0,
      avgCpc: 0,
      avgCtr: 0,
      totalVideoViews: 0,
      totalOutboundClicks: 0,
      totalPurchases: 0,
      totalPurchaseValue: 0,
      roas: 0,
      cpa: 0,
      campaigns: []
    };
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + Number(c.spend || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + Number(c.clicks || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + Number(c.impressions || 0), 0);
  const totalReach = campaigns.reduce((sum, c) => sum + Number(c.reach || 0), 0);
  
  // Video views (busca dentro das actions)
  const totalVideoViews = campaigns.reduce((sum, c) => {
    if (c.actions && Array.isArray(c.actions)) {
      const videoView = c.actions.find(a => a.action_type === 'video_view');
      return sum + Number(videoView?.value || 0);
    }
    return sum;
  }, 0);
  
  // Outbound clicks (cliques de saída)
  const totalOutboundClicks = campaigns.reduce((sum, c) => {
    if (c.outbound_clicks && Array.isArray(c.outbound_clicks)) {
      return sum + c.outbound_clicks.reduce((s, oc) => s + Number(oc.value || 0), 0);
    }
    return sum;
  }, 0);
  
  // Purchases (compras) das actions
  const totalPurchases = campaigns.reduce((sum, c) => {
    if (c.actions && Array.isArray(c.actions)) {
      const purchase = c.actions.find(a => 
        a.action_type === 'purchase' || 
        a.action_type === 'omni_purchase' ||
        a.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      return sum + Number(purchase?.value || 0);
    }
    return sum;
  }, 0);
  
  // Valor total das compras
  const totalPurchaseValue = campaigns.reduce((sum, c) => {
    if (c.action_values && Array.isArray(c.action_values)) {
      const purchaseValue = c.action_values.find(a => 
        a.action_type === 'purchase' || 
        a.action_type === 'omni_purchase' ||
        a.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      return sum + Number(purchaseValue?.value || 0);
    }
    return sum;
  }, 0);
  
  // Média ponderada do CPC (gasto total / cliques totais)
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  
  // Média ponderada do CTR (cliques totais / impressões totais * 100)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  
  // ROAS (Return on Ad Spend) = Valor das vendas / Gasto
  const roas = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
  
  // CPA (Cost per Acquisition) = Gasto / Número de compras
  const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

  // Ordena pelo maior gasto
  const sortedCampaigns = [...campaigns].sort((a, b) => Number(b.spend) - Number(a.spend));

  return {
    totalSpend,
    totalClicks,
    totalImpressions,
    totalReach,
    avgCpc,
    avgCtr,
    totalVideoViews,
    totalOutboundClicks,
    totalPurchases,
    totalPurchaseValue,
    roas,
    cpa,
    campaigns: sortedCampaigns
  };
}

/**
 * Busca status das campanhas (ativa/pausada) com data de criação
 */
export async function getCampaignsStatus(): Promise<Map<string, string>> {
  if (!AD_ACCOUNT_ID || !ACCESS_TOKEN) return new Map();

  const url = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/campaigns?` + new URLSearchParams({
    access_token: ACCESS_TOKEN,
    fields: 'id,name,status,effective_status,created_time',
    limit: '50'
  });

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    const data = await res.json();
    
    const statusMap = new Map<string, string>();
    if (data.data) {
      data.data.forEach((campaign: any) => {
        statusMap.set(campaign.id, campaign.effective_status || campaign.status);
      });
    }
    return statusMap;
  } catch (error) {
    console.error('Erro ao buscar status das campanhas:', error);
    return new Map();
  }
}
