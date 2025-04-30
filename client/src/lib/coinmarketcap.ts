import axios from 'axios';

// Function to fetch LYX price in USD from CoinMarketCap
export async function getLYXPrice(): Promise<number> {
  try {
    const response = await axios.get('/api/price/lyx');
    return response.data.price;
  } catch (error) {
    console.error('Error fetching LYX price:', error);
    throw new Error('Failed to fetch current LYX price. Please try again later.');
  }
}

// Function to calculate the amount of LYX required for a given USD amount
export function calculateLYXAmount(lyxPriceUSD: number, usdAmount: number = 3): number {
  if (!lyxPriceUSD || lyxPriceUSD <= 0) {
    throw new Error('Invalid LYX price');
  }

  // Calculate LYX amount based on the formula: USD amount / LYX price
  const lyxAmount = usdAmount / lyxPriceUSD;
  
  // Round to 2 decimal places
  return Math.round(lyxAmount * 100) / 100;
}