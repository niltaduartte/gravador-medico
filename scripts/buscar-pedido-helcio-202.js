const fetch = require('node-fetch');

const APPMAX_TOKEN = 'B6C99C65-4FAE30A5-BB3DFD79-CCEDE0B7';

async function buscarPedidoHelcio() {
  console.log('\n🔍 BUSCANDO PEDIDO HELCIO R$ 202,80 NA APPMAX\n');
  
  let allOrders = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(
      `https://admin.appmax.com.br/api/v3/order?page=${page}`,
      {
        headers: {
          'access-token': APPMAX_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const result = await response.json();
    
    if (result.data && result.data.data) {
      allOrders = allOrders.concat(result.data.data);
      console.log(`   Página ${page}: ${result.data.data.length} pedidos carregados`);
      
      hasMore = page < result.data.last_page;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`\n   Total: ${allOrders.length} pedidos carregados`);
  
  // Buscar pedidos do Helcio
  const helcioOrders = allOrders.filter(order => {
    const customerName = order.customer?.fullname || 
                        `${order.customer?.firstname || ''} ${order.customer?.lastname || ''}`.trim() ||
                        order.customer_name || '';
    
    return customerName.toLowerCase().includes('helcio');
  });
  
  console.log(`\n   Pedidos do Helcio: ${helcioOrders.length}\n`);
  
  // Procurar o de 202.80
  helcioOrders.forEach(order => {
    const total = parseFloat(order.total || 0);
    const paymentType = order.payment_type || order.payment_method || 'unknown';
    const status = order.status || 'unknown';
    
    console.log(`   ID: ${order.id}`);
    console.log(`   Valor: R$ ${total.toFixed(2)}`);
    console.log(`   Payment Type: ${paymentType}`);
    console.log(`   Status: ${status}`);
    console.log(`   Data: ${order.created_at || order.date}`);
    
    if (total === 202.80) {
      console.log(`   >>> ENCONTRADO! <<<`);
    }
    console.log('');
  });
}

buscarPedidoHelcio().catch(console.error);
