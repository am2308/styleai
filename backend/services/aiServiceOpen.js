import axios from 'axios';
import marketplaceService from './marketplaceService.js';

// Enhanced AI service with OpenAI integration and proper fallback handling
class OpenAIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    console.log('Using OpenAI service for outfit recommendations');
  }

  // Generate fallback product names based on category and color
  generateFallbackProductName(category, color, index = 0) {
    const productTemplates = {
      'Tops': [
        'Classic Button-Down Shirt',
        'Casual Cotton T-Shirt',
        'Elegant Blouse',
        'Professional Shirt',
        'Summer Light Top',
        'Trendy Tank Top'
      ],
      'Bottoms': [
        'Classic Denim Jeans',
        'Formal Trousers',
        'Casual Chinos',
        'Summer Shorts',
        'Elegant Pants',
        'Comfortable Leggings'
      ],
      'Dresses': [
        'Elegant Evening Dress',
        'Casual Summer Dress',
        'Business Dress',
        'Party Dress',
        'Formal Gown',
        'Cocktail Dress'
      ],
      'Outerwear': [
        'Classic Blazer',
        'Casual Jacket',
        'Winter Coat',
        'Leather Jacket',
        'Trench Coat',
        'Cardigan'
      ],
      'Footwear': [
        'Classic Leather Shoes',
        'Casual Sneakers',
        'Elegant Heels',
        'Running Shoes',
        'Boots',
        'Sandals'
      ],
      'Accessories': [
        'Classic Watch',
        'Leather Belt',
        'Fashion Jewelry',
        'Designer Bag',
        'Sunglasses',
        'Scarf'
      ]
    };

    const templates = productTemplates[category] || productTemplates['Tops'];
    const template = templates[index % templates.length];
    
    // Add color if provided
    if (color && color !== 'Multi') {
      return `${color} ${template}`;
    }
    
    return template;
  }

  // Get high-quality image for category
  getImageForCategory(category, index = 0) {
    const categoryImages = {
      'Tops': [
        'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/8532616/pexels-photo-8532616.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=600'
      ],
      'Bottoms': [
        'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/7679471/pexels-photo-7679471.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600'
      ],
      'Dresses': [
        'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/7679471/pexels-photo-7679471.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=600'
      ],
      'Outerwear': [
        'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/8532616/pexels-photo-8532616.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1381556/pexels-photo-1381556.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=600'
      ],
      'Footwear': [
        'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/2529147/pexels-photo-2529147.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=600'
      ],
      'Accessories': [
        'https://images.pexels.com/photos/1927259/pexels-photo-1927259.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/7679471/pexels-photo-7679471.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/8532616/pexels-photo-8532616.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=600',
        'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=600'
      ]
    };

    const images = categoryImages[category] || categoryImages['Tops'];
    return images[index % images.length];
  }

  // Generate proper marketplace URL
  generateMarketplaceURL(productName) {
    if (!productName || productName === 'undefined') {
      productName = 'fashion clothing';
    }
    
    const encodedName = encodeURIComponent(productName);
    const marketplaces = [
      `https://www.ebay.com/sch/i.html?_nkw=${encodedName}`,
      `https://www.amazon.com/s?k=${encodedName}`,
      `https://www.etsy.com/search?q=${encodedName}`,
      `https://www.target.com/s?searchTerm=${encodedName}`,
      `https://www.walmart.com/search?q=${encodedName}`,
      `https://www.zara.com/search?searchTerm=${encodedName}`
    ];
    
    return marketplaces[Math.floor(Math.random() * marketplaces.length)];
  }

  // Get marketplace source name
  getMarketplaceSource() {
    const sources = ['eBay', 'Fashion Store', 'Online Store', 'Amazon', 'Target'];
    return sources[Math.floor(Math.random() * sources.length)];
  }

  // Generate realistic price
  generateRealisticPrice(category) {
    const priceRanges = {
      'Tops': { min: 15, max: 80 },
      'Bottoms': { min: 25, max: 120 },
      'Dresses': { min: 30, max: 150 },
      'Outerwear': { min: 40, max: 200 },
      'Footwear': { min: 30, max: 180 },
      'Accessories': { min: 10, max: 60 }
    };
    
    const range = priceRanges[category] || priceRanges['Tops'];
    return Math.floor(Math.random() * (range.max - range.min) + range.min);
  }

  async generateMarketplaceRecommendations(userProfile, filters = {}) {
    try {
      const { category, color, occasion, priceRange } = filters;
      
      // Try OpenAI first if API key is available
      if (this.openaiApiKey) {
        try {
          const openaiRecommendations = await this.getOpenAIRecommendations(userProfile, filters);
          if (openaiRecommendations && openaiRecommendations.length > 0) {
            return openaiRecommendations;
          }
        } catch (error) {
          console.log('OpenAI API failed, falling back to marketplace service:', error.message);
        }
      }
      
      // Fallback to marketplace service
      return await marketplaceService.searchProducts(
        [category, color, occasion].filter(Boolean),
        category,
        priceRange,
        ['ebay', 'free']
      );
    } catch (error) {
      console.error('Error generating marketplace recommendations:', error);
      return this.getFallbackRecommendations(filters);
    }
  }

  async getOpenAIRecommendations(userProfile, filters) {
    const prompt = this.buildPrompt(userProfile, filters);
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a fashion expert. Provide product recommendations in JSON format with name, category, color, price, and description fields.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    let recommendations;
    try {
      recommendations = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Transform OpenAI recommendations to match our format with proper error handling
    if (Array.isArray(recommendations)) {
      return recommendations.map((item, index) => {
        // Handle undefined or missing values with fallbacks
        const itemName = item?.name || this.generateFallbackProductName(
          item?.category || filters.category || 'Tops',
          item?.color || filters.color || 'Black',
          index
        );
        
        const itemCategory = item?.category || filters.category || 'Tops';
        const itemColor = item?.color || filters.color || 'Black';
        const itemPrice = (item?.price && !isNaN(parseFloat(item.price))) 
          ? parseFloat(item.price) 
          : this.generateRealisticPrice(itemCategory);

        return {
          id: `openai_${index}`,
          name: itemName,
          category: itemCategory,
          color: itemColor,
          price: itemPrice,
          imageUrl: this.getImageForCategory(itemCategory, index),
          url: this.generateMarketplaceURL(itemName),
          source: this.getMarketplaceSource(),
          brand: item?.brand || 'Recommended',
          description: item?.description || `Stylish ${itemCategory.toLowerCase()} perfect for ${filters.occasion || 'any occasion'}`,
          rating: 4.5,
          relevanceScore: 10
        };
      });
    }

    // If recommendations is not an array, create fallback
    throw new Error('OpenAI response is not in expected array format');
  }

  buildPrompt(userProfile, filters) {
    const { category, color, occasion } = filters;
    
    return `Generate 5-8 fashion product recommendations for a user with the following preferences:
    - Skin tone: ${userProfile.skinTone || 'Medium'}
    - Body type: ${userProfile.bodyType || 'Rectangle'}
    - Style preference: ${userProfile.preferredStyle || 'Casual'}
    ${category ? `- Category: ${category}` : ''}
    ${color ? `- Color preference: ${color}` : ''}
    ${occasion ? `- Occasion: ${occasion}` : ''}
    
    Return a JSON array of products with the following structure:
    [
      {
        "name": "Product Name",
        "category": "Tops|Bottoms|Dresses|Outerwear|Footwear|Accessories",
        "color": "Color Name",
        "price": 49.99,
        "description": "Brief description",
        "brand": "Brand Name"
      }
    ]
    
    Ensure all fields are properly filled and prices are realistic.`;
  }

  getFallbackRecommendations(filters) {
    const { category, color } = filters;
    const fallbackProducts = [];
    
    for (let i = 0; i < 6; i++) {
      const productCategory = category || ['Tops', 'Bottoms', 'Dresses'][i % 3];
      const productColor = color || ['Black', 'White', 'Blue', 'Red'][i % 4];
      const productName = this.generateFallbackProductName(productCategory, productColor, i);
      
      fallbackProducts.push({
        id: `fallback_${i}`,
        name: productName,
        category: productCategory,
        color: productColor,
        price: this.generateRealisticPrice(productCategory),
        imageUrl: this.getImageForCategory(productCategory, i),
        url: this.generateMarketplaceURL(productName),
        source: this.getMarketplaceSource(),
        brand: 'StyleAI',
        description: `Recommended ${productCategory.toLowerCase()} that matches your style preferences`,
        rating: 4.3,
        relevanceScore: 8
      });
    }
    
    return fallbackProducts;
  }
}

const openaiService = new OpenAIService();

export const generateMarketplaceRecommendations = async (userProfile, filters = {}) => {
  return await openaiService.generateMarketplaceRecommendations(userProfile, filters);
};

export default openaiService;