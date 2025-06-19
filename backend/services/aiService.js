import axios from 'axios';
import marketplaceService from './marketplaceService.js';

// Enhanced AI service with OpenAI GPT-4.1 integration
class OpenAIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    console.log('Using OpenAI GPT-4.1 service for outfit recommendations');
    
    if (!this.openaiApiKey) {
      console.warn('⚠️  OpenAI API key not found. Add OPENAI_API_KEY to your environment variables for AI-powered recommendations.');
    }
  }

  async generateOutfitRecommendations(wardrobeItems, userProfile, occasion = null) {
    try {
      console.log('Generating outfit recommendations for', wardrobeItems.length, 'items, occasion:', occasion);

      // Try OpenAI first if API key is available
      if (this.openaiApiKey && wardrobeItems.length > 0) {
        try {
          const openaiRecommendations = await this.getOpenAIOutfitRecommendations(wardrobeItems, userProfile, occasion);
          if (openaiRecommendations && openaiRecommendations.recommendations.length > 0) {
            console.log('Generated OpenAI recommendations:', openaiRecommendations.recommendations.length);
            return openaiRecommendations;
          }
        } catch (error) {
          console.log('OpenAI API failed, falling back to local AI:', error.message);
        }
      }

      // Fallback to local AI analysis
      const analysis = this.analyzeWardrobe(wardrobeItems, userProfile);
      const outfits = this.generateComprehensiveOutfitCombinations(wardrobeItems, userProfile, occasion);
      
      const outfitsWithMissing = await Promise.all(
        outfits.map(async outfit => {
          const missingItems = await this.identifyMissingItemsWithProducts(outfit, wardrobeItems, userProfile);
          return {
            ...outfit,
            missingItems: missingItems
          };
        })
      );

      console.log('Generated local recommendations:', outfitsWithMissing.length);

      return {
        recommendations: outfitsWithMissing,
        wardrobeAnalysis: analysis
      };
    } catch (error) {
      console.error('Error generating outfit recommendations:', error);
      return this.getMockRecommendations(wardrobeItems, userProfile, occasion);
    }
  }

  async getOpenAIOutfitRecommendations(wardrobeItems, userProfile, occasion) {
    const prompt = this.buildOutfitPrompt(wardrobeItems, userProfile, occasion);
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-1106-preview', // GPT-4.1 Turbo model
        messages: [
          {
            role: 'system',
            content: `You are an expert fashion stylist and personal shopper with deep knowledge of:
            - Color theory and coordination
            - Body type styling
            - Occasion-appropriate dressing
            - Current fashion trends
            - Brand knowledge and quality assessment
            
            Provide detailed outfit recommendations in JSON format. Be creative, practical, and consider the user's personal style preferences.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    let aiResponse;
    try {
      aiResponse = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Transform OpenAI response to our format
    return this.transformOpenAIResponse(aiResponse, wardrobeItems, userProfile);
  }

  buildOutfitPrompt(wardrobeItems, userProfile, occasion) {
    const wardrobeDescription = wardrobeItems.map(item => 
      `- ${item.name} (${item.category}, ${item.color})`
    ).join('\n');

    return `Create outfit recommendations using the following wardrobe items:

WARDROBE ITEMS:
${wardrobeDescription}

USER PROFILE:
- Skin Tone: ${userProfile.skinTone || 'Not specified'}
- Body Type: ${userProfile.bodyType || 'Not specified'}
- Style Preference: ${userProfile.preferredStyle || 'Not specified'}
${occasion ? `- Occasion: ${occasion}` : ''}

TASK:
Create 3-5 complete outfit combinations using ONLY the provided wardrobe items. For each outfit:

1. Select 2-4 items that work well together
2. Provide styling confidence score (0-100)
3. Explain why the combination works
4. Give styling tips
5. Identify any missing items that would complete the look

Return response in this JSON format:
{
  "recommendations": [
    {
      "items": ["item_id_1", "item_id_2"],
      "confidence": 85,
      "occasion": "Casual",
      "description": "Stylish casual outfit perfect for...",
      "styleNotes": "The color combination creates...",
      "missingItems": [
        {
          "category": "Footwear",
          "description": "White sneakers to complete the casual look",
          "priority": "medium"
        }
      ]
    }
  ],
  "wardrobeAnalysis": {
    "strengths": ["Good color variety", "Versatile basics"],
    "gaps": ["Missing formal shoes", "Need more outerwear"],
    "suggestions": ["Add a blazer for professional looks"]
  }
}

IMPORTANT: 
- Use actual item IDs from the wardrobe
- Consider color coordination, style harmony, and occasion appropriateness
- Be specific about why combinations work
- Suggest realistic missing items with proper categories`;
  }

  transformOpenAIResponse(aiResponse, wardrobeItems, userProfile) {
    const recommendations = aiResponse.recommendations || [];
    
    const transformedRecommendations = recommendations.map((rec, index) => {
      // Validate that recommended items exist in wardrobe
      const validItems = rec.items?.filter(itemId => 
        wardrobeItems.some(item => item.id === itemId)
      ) || [];

      // If no valid items, create a combination from available items
      if (validItems.length === 0 && wardrobeItems.length >= 2) {
        validItems.push(wardrobeItems[0].id, wardrobeItems[1].id);
      }

      return {
        id: `openai_outfit_${index}`,
        items: validItems,
        confidence: (rec.confidence || 75) / 100, // Convert to 0-1 scale
        occasion: rec.occasion || 'Casual',
        description: rec.description || 'AI-curated outfit combination',
        styleNotes: rec.styleNotes || 'Thoughtfully selected pieces that complement each other',
        missingItems: this.transformMissingItems(rec.missingItems || [])
      };
    }).filter(rec => rec.items.length > 0);

    return {
      recommendations: transformedRecommendations,
      wardrobeAnalysis: aiResponse.wardrobeAnalysis || this.analyzeWardrobe(wardrobeItems, userProfile)
    };
  }

  transformMissingItems(missingItems) {
    return missingItems.map(item => ({
      category: item.category || 'Accessories',
      color: item.color || 'Black',
      description: item.description || 'Recommended item to complete the look',
      searchTerms: [item.category?.toLowerCase(), item.color?.toLowerCase()].filter(Boolean),
      priority: item.priority || 'medium',
      priceRange: {
        min: 20,
        max: 100
      },
      availableProducts: [] // Will be populated by marketplace service
    }));
  }

  // Enhanced wardrobe analysis with AI insights
  analyzeWardrobe(items, userProfile) {
    const categories = {};
    const colors = {};
    const occasions = {};
    
    items.forEach(item => {
      categories[item.category] = (categories[item.category] || 0) + 1;
      colors[item.color] = (colors[item.color] || 0) + 1;
      
      const itemOccasions = this.getItemOccasions(item, userProfile);
      itemOccasions.forEach(occ => {
        occasions[occ] = (occasions[occ] || 0) + 1;
      });
    });

    const strengths = [];
    const gaps = [];
    const suggestions = [];

    // Analyze category distribution
    if (categories['Tops'] >= 3) strengths.push('Good variety of tops');
    if (categories['Bottoms'] >= 2) strengths.push('Sufficient bottom wear');
    if (categories['Footwear'] >= 2) strengths.push('Good footwear collection');
    if (categories['Dresses'] >= 1) strengths.push('Elegant dress options');
    if (Object.keys(colors).length >= 4) strengths.push('Great color variety');
    if (categories['Outerwear'] >= 1) strengths.push('Good layering options');

    // Identify gaps
    if (!categories['Tops'] || categories['Tops'] < 3) {
      gaps.push('Need more versatile tops');
      suggestions.push('Add 2-3 more tops in different styles');
    }
    if (!categories['Bottoms'] || categories['Bottoms'] < 2) {
      gaps.push('Limited bottom wear options');
      suggestions.push('Add jeans, trousers, or skirts');
    }
    if (!categories['Outerwear']) {
      gaps.push('Missing outerwear for layering');
      suggestions.push('Add a blazer or jacket for versatility');
    }
    if (!categories['Accessories'] || categories['Accessories'] < 2) {
      gaps.push('Limited accessories');
      suggestions.push('Add accessories to enhance outfits');
    }
    if (!categories['Footwear'] || categories['Footwear'] < 2) {
      gaps.push('Need more footwear variety');
      suggestions.push('Add shoes for different occasions');
    }

    return { strengths, gaps, suggestions };
  }

  // Generate comprehensive outfit combinations (fallback method)
  generateComprehensiveOutfitCombinations(items, userProfile, occasion) {
    const outfits = [];
    
    const tops = items.filter(item => item.category === 'Tops');
    const bottoms = items.filter(item => item.category === 'Bottoms');
    const dresses = items.filter(item => item.category === 'Dresses');
    const outerwear = items.filter(item => item.category === 'Outerwear');
    const footwear = items.filter(item => item.category === 'Footwear');
    const accessories = items.filter(item => item.category === 'Accessories');

    // Generate dress-based outfits
    dresses.forEach((dress, index) => {
      const outfit = {
        id: `dress_outfit_${index + 1}`,
        items: [dress.id],
        confidence: this.calculateConfidence([dress], userProfile, occasion, 'dress'),
        occasion: occasion || this.getBestOccasionForItem(dress, userProfile),
        description: this.generateOutfitDescription([dress], occasion, userProfile),
        styleNotes: this.generateStyleNotes([dress], userProfile)
      };
      
      if (footwear.length > 0) {
        const bestShoes = this.findBestMatch(footwear, dress, occasion);
        if (bestShoes) outfit.items.push(bestShoes.id);
      }
      
      if (accessories.length > 0 && userProfile.preferredStyle !== 'Minimalist') {
        const bestAccessory = this.findBestMatch(accessories, dress, occasion);
        if (bestAccessory) outfit.items.push(bestAccessory.id);
      }
      
      outfits.push(outfit);
    });

    // Generate top + bottom combinations
    tops.forEach((top, topIndex) => {
      bottoms.forEach((bottom, bottomIndex) => {
        if (outfits.length >= 6) return; // Limit total outfits
        
        const outfit = {
          id: `combo_outfit_${topIndex}_${bottomIndex}`,
          items: [top.id, bottom.id],
          confidence: this.calculateConfidence([top, bottom], userProfile, occasion, 'combo'),
          occasion: occasion || this.getBestOccasionForItems([top, bottom], userProfile),
          description: this.generateOutfitDescription([top, bottom], occasion, userProfile),
          styleNotes: this.generateStyleNotes([top, bottom], userProfile)
        };

        if (footwear.length > 0) {
          const bestShoes = this.findBestMatch(footwear, top, occasion);
          if (bestShoes) outfit.items.push(bestShoes.id);
        }

        if (accessories.length > 0 && userProfile.preferredStyle !== 'Minimalist') {
          const bestAccessory = this.findBestMatch(accessories, top, occasion);
          if (bestAccessory) outfit.items.push(bestAccessory.id);
        }

        outfits.push(outfit);
      });
    });

    return outfits.slice(0, 6).map(outfit => ({
      ...outfit,
      confidence: Math.min(outfit.confidence, 0.95)
    }));
  }

  // Helper methods (keeping existing implementations)
  calculateConfidence(items, userProfile, occasion, type) {
    let confidence = 0.5;

    if (occasion) {
      const occasionScore = this.getOccasionMatchScore(items, occasion, userProfile);
      confidence += occasionScore * 0.3;
    }

    if (userProfile.preferredStyle) {
      const styleScore = this.getStyleMatchScore(items, userProfile.preferredStyle);
      confidence += styleScore * 0.2;
    }

    if (items.length > 1) {
      const colorScore = this.getColorCoordinationScore(items);
      confidence += colorScore * 0.15;
    }

    const completenessScore = this.getCompletenessScore(items);
    confidence += completenessScore * 0.15;

    if (userProfile.bodyType) {
      const bodyTypeScore = this.getBodyTypeScore(items, userProfile.bodyType);
      confidence += bodyTypeScore * 0.1;
    }

    const seasonScore = this.getSeasonalScore(items);
    confidence += seasonScore * 0.1;

    return Math.max(0.3, Math.min(confidence, 0.95));
  }

  getOccasionMatchScore(items, occasion, userProfile) {
    const occasionKeywords = {
      'Casual': ['casual', 't-shirt', 'jeans', 'sneakers', 'comfortable'],
      'Work': ['shirt', 'blouse', 'trousers', 'blazer', 'professional', 'formal'],
      'Formal': ['dress', 'suit', 'formal', 'elegant', 'blazer', 'heels'],
      'Date Night': ['dress', 'elegant', 'stylish', 'attractive'],
      'Party': ['dress', 'stylish', 'fun', 'colorful', 'trendy'],
      'Weekend': ['casual', 'comfortable', 'relaxed', 'jeans'],
      'Travel': ['comfortable', 'versatile', 'practical', 'layers']
    };

    const keywords = occasionKeywords[occasion] || [];
    let score = 0;
    
    items.forEach(item => {
      const itemText = `${item.name} ${item.category}`.toLowerCase();
      const matches = keywords.filter(keyword => itemText.includes(keyword)).length;
      score += matches / keywords.length;
    });

    return score / items.length;
  }

  getStyleMatchScore(items, preferredStyle) {
    const styleKeywords = {
      'Casual': ['casual', 't-shirt', 'jeans', 'sneakers', 'comfortable'],
      'Business': ['shirt', 'blazer', 'trousers', 'formal', 'professional'],
      'Formal': ['dress', 'suit', 'formal', 'elegant', 'classic'],
      'Bohemian': ['flowy', 'boho', 'loose', 'artistic', 'free'],
      'Minimalist': ['simple', 'clean', 'basic', 'minimal', 'sleek'],
      'Trendy': ['fashion', 'trendy', 'modern', 'stylish', 'contemporary'],
      'Classic': ['classic', 'timeless', 'traditional', 'elegant']
    };

    const keywords = styleKeywords[preferredStyle] || [];
    let score = 0;
    
    items.forEach(item => {
      const itemText = `${item.name} ${item.category}`.toLowerCase();
      const matches = keywords.filter(keyword => itemText.includes(keyword)).length;
      score += matches / keywords.length;
    });

    return score / items.length;
  }

  getColorCoordinationScore(items) {
    const colors = items.map(item => item.color.toLowerCase());
    const neutrals = ['black', 'white', 'gray', 'grey', 'brown', 'beige', 'navy'];
    const hasNeutral = colors.some(color => neutrals.includes(color));
    
    if (hasNeutral) return 0.8;
    if (colors.every(color => color === colors[0])) return 0.9;
    
    const complementaryPairs = [
      ['blue', 'orange'], ['red', 'green'], ['yellow', 'purple'],
      ['blue', 'white'], ['red', 'white'], ['black', 'white']
    ];
    
    for (const pair of complementaryPairs) {
      if (colors.includes(pair[0]) && colors.includes(pair[1])) {
        return 0.7;
      }
    }
    
    return 0.4;
  }

  getCompletenessScore(items) {
    const categories = items.map(item => item.category);
    let score = 0;
    
    if (categories.includes('Dresses') || 
        (categories.includes('Tops') && categories.includes('Bottoms'))) {
      score += 0.5;
    }
    
    if (categories.includes('Footwear')) score += 0.2;
    if (categories.includes('Outerwear')) score += 0.2;
    if (categories.includes('Accessories')) score += 0.1;
    
    return score;
  }

  getBodyTypeScore(items, bodyType) {
    const bodyTypePreferences = {
      'Pear': ['a-line', 'flowy', 'loose top', 'fitted bottom'],
      'Apple': ['empire waist', 'v-neck', 'loose', 'flowy'],
      'Hourglass': ['fitted', 'belted', 'wrap', 'tailored'],
      'Rectangle': ['layered', 'textured', 'ruffles', 'patterns'],
      'Inverted Triangle': ['wide leg', 'a-line', 'loose bottom', 'fitted top']
    };
    
    const preferences = bodyTypePreferences[bodyType] || [];
    let score = 0;
    
    items.forEach(item => {
      const itemText = item.name.toLowerCase();
      const matches = preferences.filter(pref => itemText.includes(pref)).length;
      score += matches / preferences.length;
    });
    
    return score / items.length;
  }

  getSeasonalScore(items) {
    const currentMonth = new Date().getMonth();
    const season = this.getCurrentSeason(currentMonth);
    
    const seasonalItems = {
      'spring': ['light', 'cotton', 'pastel', 'jacket'],
      'summer': ['light', 'cotton', 'shorts', 'sandals', 'bright'],
      'fall': ['warm', 'layers', 'jacket', 'boots', 'sweater'],
      'winter': ['warm', 'coat', 'boots', 'sweater', 'layers']
    };
    
    const seasonalKeywords = seasonalItems[season] || [];
    let score = 0;
    
    items.forEach(item => {
      const itemText = `${item.name} ${item.category}`.toLowerCase();
      const matches = seasonalKeywords.filter(keyword => itemText.includes(keyword)).length;
      score += matches / seasonalKeywords.length;
    });
    
    return score / items.length;
  }

  getCurrentSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  getItemOccasions(item, userProfile) {
    const itemText = `${item.name} ${item.category}`.toLowerCase();
    const occasions = [];
    
    if (itemText.includes('casual') || itemText.includes('t-shirt') || itemText.includes('jeans')) {
      occasions.push('Casual', 'Weekend');
    }
    if (itemText.includes('formal') || itemText.includes('dress') || itemText.includes('suit')) {
      occasions.push('Formal', 'Date Night');
    }
    if (itemText.includes('work') || itemText.includes('business') || itemText.includes('blazer')) {
      occasions.push('Work');
    }
    if (itemText.includes('party') || itemText.includes('stylish')) {
      occasions.push('Party');
    }
    
    return occasions.length > 0 ? occasions : ['Casual'];
  }

  getBestOccasionForItem(item, userProfile) {
    const occasions = this.getItemOccasions(item, userProfile);
    return occasions[0] || 'Casual';
  }

  getBestOccasionForItems(items, userProfile) {
    const allOccasions = items.flatMap(item => this.getItemOccasions(item, userProfile));
    const occasionCounts = {};
    
    allOccasions.forEach(occ => {
      occasionCounts[occ] = (occasionCounts[occ] || 0) + 1;
    });
    
    return Object.keys(occasionCounts).reduce((a, b) => 
      occasionCounts[a] > occasionCounts[b] ? a : b
    ) || 'Casual';
  }

  findBestMatch(items, baseItem, occasion) {
    if (items.length === 0) return null;
    
    const scoredItems = items.map(item => ({
      item,
      score: this.getMatchScore(item, baseItem, occasion)
    }));
    
    scoredItems.sort((a, b) => b.score - a.score);
    return scoredItems[0].item;
  }

  getMatchScore(item, baseItem, occasion) {
    let score = 0;
    
    if (this.colorsMatch([item.color, baseItem.color])) {
      score += 0.5;
    }
    
    const itemOccasions = this.getItemOccasions(item, {});
    if (occasion && itemOccasions.includes(occasion)) {
      score += 0.3;
    }
    
    if (this.categoriesMatch(item.category, baseItem.category, occasion)) {
      score += 0.2;
    }
    
    return score;
  }

  colorsMatch(colors) {
    const neutrals = ['black', 'white', 'gray', 'grey', 'brown', 'beige'];
    const hasNeutral = colors.some(color => neutrals.includes(color.toLowerCase()));
    
    if (hasNeutral) return true;
    if (colors[0].toLowerCase() === colors[1].toLowerCase()) return true;
    
    const complementary = {
      'blue': ['white', 'gray', 'black', 'brown'],
      'red': ['white', 'black', 'gray'],
      'green': ['white', 'black', 'brown'],
      'yellow': ['black', 'white', 'blue']
    };
    
    const color1 = colors[0].toLowerCase();
    const color2 = colors[1].toLowerCase();
    
    return complementary[color1]?.includes(color2) || complementary[color2]?.includes(color1);
  }

  categoriesMatch(category1, category2, occasion) {
    const goodCombinations = {
      'Tops': ['Bottoms', 'Outerwear', 'Accessories', 'Footwear'],
      'Bottoms': ['Tops', 'Outerwear', 'Accessories', 'Footwear'],
      'Dresses': ['Outerwear', 'Accessories', 'Footwear'],
      'Outerwear': ['Tops', 'Bottoms', 'Dresses', 'Footwear'],
      'Footwear': ['Tops', 'Bottoms', 'Dresses', 'Outerwear'],
      'Accessories': ['Tops', 'Bottoms', 'Dresses', 'Outerwear']
    };
    
    return goodCombinations[category1]?.includes(category2) || false;
  }

  generateOutfitDescription(items, occasion, userProfile) {
    const categories = items.map(item => item.category);
    const colors = items.map(item => item.color);
    const primaryColor = colors[0];
    
    if (categories.includes('Dresses')) {
      const dress = items.find(item => item.category === 'Dresses');
      return `Elegant ${dress.color.toLowerCase()} dress perfect for ${occasion || 'any occasion'}. ${this.getStyleDescription(userProfile.preferredStyle)}`;
    } else {
      const top = items.find(item => item.category === 'Tops');
      const bottom = items.find(item => item.category === 'Bottoms');
      
      if (top && bottom) {
        return `Stylish combination of ${top.color.toLowerCase()} ${top.name.toLowerCase()} with ${bottom.color.toLowerCase()} ${bottom.name.toLowerCase()}. Perfect for ${occasion || 'everyday wear'}.`;
      }
    }
    
    return `A well-coordinated outfit featuring ${primaryColor.toLowerCase()} tones, ideal for ${occasion || 'various occasions'}.`;
  }

  generateStyleNotes(items, userProfile) {
    const notes = [];
    
    if (userProfile.skinTone) {
      notes.push(`The color palette complements your ${userProfile.skinTone} skin tone beautifully.`);
    }
    
    if (userProfile.bodyType) {
      notes.push(`This combination flatters your ${userProfile.bodyType} body type.`);
    }
    
    if (userProfile.preferredStyle) {
      notes.push(`Perfectly aligned with your ${userProfile.preferredStyle} style preference.`);
    }
    
    const colors = items.map(item => item.color);
    if (colors.length > 1 && this.colorsMatch(colors)) {
      notes.push(`The color coordination creates a harmonious and polished look.`);
    }
    
    return notes.join(' ') || 'A well-balanced outfit that showcases your personal style.';
  }

  getStyleDescription(style) {
    const descriptions = {
      'Casual': 'Comfortable and relaxed for everyday activities.',
      'Business': 'Professional and polished for the workplace.',
      'Formal': 'Sophisticated and elegant for special occasions.',
      'Bohemian': 'Free-spirited and artistic with flowing elements.',
      'Minimalist': 'Clean and simple with understated elegance.',
      'Trendy': 'Fashion-forward and contemporary.',
      'Classic': 'Timeless and traditional with enduring appeal.'
    };
    
    return descriptions[style] || 'Stylish and versatile for various occasions.';
  }

  async identifyMissingItemsWithProducts(outfit, wardrobeItems, userProfile) {
    const missingItems = [];
    const outfitItems = wardrobeItems.filter(item => outfit.items.includes(item.id));
    const categories = outfitItems.map(item => item.category);

    if (!categories.includes('Footwear')) {
      const footwearItem = {
        category: 'Footwear',
        color: this.suggestComplementaryColor(outfitItems),
        description: `${outfit.occasion} shoes to complete the outfit`,
        searchTerms: this.generateSearchTerms('Footwear', outfit.occasion, userProfile),
        priority: 'high',
        priceRange: { min: 30, max: 120 }
      };
      
      try {
        const products = await marketplaceService.searchProducts(
          footwearItem.searchTerms,
          'Footwear',
          footwearItem.priceRange,
          ['ebay', 'free']
        );
        footwearItem.availableProducts = products.slice(0, 3);
      } catch (error) {
        footwearItem.availableProducts = [];
      }
      
      missingItems.push(footwearItem);
    }

    if (!categories.includes('Accessories') && userProfile.preferredStyle !== 'Minimalist') {
      const accessoryItem = {
        category: 'Accessories',
        color: 'Multi',
        description: `Accessories to enhance your ${outfit.occasion.toLowerCase()} look`,
        searchTerms: this.generateSearchTerms('Accessories', outfit.occasion, userProfile),
        priority: 'medium',
        priceRange: { min: 15, max: 60 }
      };
      
      try {
        const products = await marketplaceService.searchProducts(
          accessoryItem.searchTerms,
          'Accessories',
          accessoryItem.priceRange,
          ['ebay', 'free']
        );
        accessoryItem.availableProducts = products.slice(0, 3);
      } catch (error) {
        accessoryItem.availableProducts = [];
      }
      
      missingItems.push(accessoryItem);
    }

    return missingItems;
  }

  suggestComplementaryColor(items) {
    const colors = items.map(item => item.color.toLowerCase());
    const hasNeutral = colors.some(color => ['black', 'white', 'gray', 'brown'].includes(color));
    
    if (hasNeutral) return 'Black';
    if (colors.includes('blue')) return 'Brown';
    if (colors.includes('red')) return 'Black';
    
    return 'Black';
  }

  generateSearchTerms(category, occasion, userProfile) {
    const baseTerms = [category.toLowerCase()];
    
    if (occasion) {
      baseTerms.push(occasion.toLowerCase());
    }
    
    if (userProfile.preferredStyle) {
      baseTerms.push(userProfile.preferredStyle.toLowerCase());
    }
    
    const categoryTerms = {
      'Footwear': ['shoes', 'boots', 'sneakers'],
      'Accessories': ['jewelry', 'watch', 'belt', 'bag'],
      'Outerwear': ['jacket', 'blazer', 'coat'],
      'Tops': ['shirt', 'blouse', 'top'],
      'Bottoms': ['pants', 'jeans', 'trousers']
    };
    
    if (categoryTerms[category]) {
      baseTerms.push(...categoryTerms[category]);
    }
    
    return baseTerms.filter(term => term && term.length > 0);
  }

  getMockRecommendations(wardrobeItems, userProfile, occasion) {
    return {
      recommendations: [
        {
          id: 'mock_outfit_1',
          items: wardrobeItems.slice(0, Math.min(2, wardrobeItems.length)).map(item => item.id),
          confidence: 0.75,
          occasion: occasion || 'Casual',
          description: 'A versatile outfit that works well with your style preferences.',
          styleNotes: 'This combination creates a balanced look that complements your features.',
          missingItems: []
        }
      ],
      wardrobeAnalysis: {
        strengths: ['Good foundation pieces'],
        gaps: ['Could use more accessories'],
        suggestions: ['Consider adding versatile pieces that can be mixed and matched']
      }
    };
  }
}

const aiService = new OpenAIService();

export const generateOutfitRecommendations = async (wardrobeItems, userProfile, occasion = null) => {
  return await aiService.generateOutfitRecommendations(wardrobeItems, userProfile, occasion);
};

export const generateMarketplaceRecommendations = async (userProfile, filters = {}) => {
  try {
    const { category, color, occasion, priceRange } = filters;
    
    // Generate search terms based on user profile and filters
    const searchTerms = generateSearchTerms(userProfile, { category, color, occasion });
    
    // Search marketplace with proper sources
    const products = await marketplaceService.searchProducts(
      searchTerms,
      category,
      priceRange,
      ['ebay', 'free']
    );

    // Filter and rank products based on user preferences
    const rankedProducts = rankProductsForUser(products, userProfile);

    return rankedProducts.slice(0, 20);
  } catch (error) {
    console.error('Error generating marketplace recommendations:', error);
    return getFallbackMarketplaceItems();
  }
};

export const generateSmartShoppingList = async (wardrobeItems, userProfile, targetOccasions = []) => {
  try {
    // Analyze wardrobe gaps
    const analysis = aiService.analyzeWardrobe(wardrobeItems, userProfile);
    
    // Generate shopping recommendations based on gaps
    const shoppingList = await generateShoppingRecommendationsWithProducts(analysis, userProfile, targetOccasions);
    
    return { shoppingList };
  } catch (error) {
    console.error('Error generating smart shopping list:', error);
    return { shoppingList: [] };
  }
};

// Enhanced shopping recommendations with marketplace integration
async function generateShoppingRecommendationsWithProducts(analysis, userProfile, targetOccasions) {
  const recommendations = [];

  for (const gap of analysis.gaps) {
    if (gap.includes('tops') && recommendations.length < 5) {
      const item = {
        item: `${userProfile.preferredStyle || 'Versatile'} Top`,
        category: 'Tops',
        priority: 'high',
        reason: 'Essential for creating multiple outfit combinations',
        searchTerms: ['shirt', 'top', 'blouse', userProfile.preferredStyle?.toLowerCase()].filter(Boolean),
        priceRange: { min: 20, max: 80 },
        occasions: targetOccasions.length > 0 ? targetOccasions : ['Casual', 'Work']
      };
      
      try {
        const products = await marketplaceService.searchProducts(
          item.searchTerms,
          'Tops',
          item.priceRange,
          ['ebay', 'free']
        );
        item.availableProducts = products.slice(0, 5);
      } catch (error) {
        item.availableProducts = [];
      }
      
      recommendations.push(item);
    }

    if (gap.includes('bottoms') && recommendations.length < 5) {
      const item = {
        item: `${userProfile.preferredStyle || 'Versatile'} Bottoms`,
        category: 'Bottoms',
        priority: 'high',
        reason: 'Essential for creating complete outfits',
        searchTerms: ['pants', 'jeans', 'trousers', userProfile.preferredStyle?.toLowerCase()].filter(Boolean),
        priceRange: { min: 25, max: 100 },
        occasions: targetOccasions.length > 0 ? targetOccasions : ['Casual', 'Work']
      };
      
      try {
        const products = await marketplaceService.searchProducts(
          item.searchTerms,
          'Bottoms',
          item.priceRange,
          ['ebay', 'free']
        );
        item.availableProducts = products.slice(0, 5);
      } catch (error) {
        item.availableProducts = [];
      }
      
      recommendations.push(item);
    }

    if (gap.includes('outerwear') && recommendations.length < 5) {
      const item = {
        item: 'Professional Blazer',
        category: 'Outerwear',
        priority: 'medium',
        reason: 'Adds professionalism and versatility to outfits',
        searchTerms: ['blazer', 'jacket', 'professional', 'work'],
        priceRange: { min: 40, max: 150 },
        occasions: ['Work', 'Formal']
      };
      
      try {
        const products = await marketplaceService.searchProducts(
          item.searchTerms,
          'Outerwear',
          item.priceRange,
          ['ebay', 'free']
        );
        item.availableProducts = products.slice(0, 5);
      } catch (error) {
        item.availableProducts = [];
      }
      
      recommendations.push(item);
    }

    if (gap.includes('footwear') && recommendations.length < 5) {
      const item = {
        item: 'Versatile Shoes',
        category: 'Footwear',
        priority: 'high',
        reason: 'Complete your outfits with appropriate footwear',
        searchTerms: ['shoes', 'footwear', userProfile.preferredStyle?.toLowerCase()].filter(Boolean),
        priceRange: { min: 30, max: 120 },
        occasions: targetOccasions.length > 0 ? targetOccasions : ['Casual', 'Work']
      };
      
      try {
        const products = await marketplaceService.searchProducts(
          item.searchTerms,
          'Footwear',
          item.priceRange,
          ['ebay', 'free']
        );
        item.availableProducts = products.slice(0, 5);
      } catch (error) {
        item.availableProducts = [];
      }
      
      recommendations.push(item);
    }

    if (gap.includes('accessories') && recommendations.length < 5) {
      const item = {
        item: 'Statement Accessories',
        category: 'Accessories',
        priority: 'medium',
        reason: 'Enhance your outfits with finishing touches',
        searchTerms: ['accessories', 'jewelry', 'watch', 'belt'],
        priceRange: { min: 15, max: 60 },
        occasions: targetOccasions.length > 0 ? targetOccasions : ['Casual', 'Work', 'Date Night']
      };
      
      try {
        const products = await marketplaceService.searchProducts(
          item.searchTerms,
          'Accessories',
          item.priceRange,
          ['ebay', 'free']
        );
        item.availableProducts = products.slice(0, 5);
      } catch (error) {
        item.availableProducts = [];
      }
      
      recommendations.push(item);
    }
  }

  return recommendations;
}

// Helper functions
function generateSearchTerms(userProfile, filters) {
  const terms = [];
  
  if (filters.category) terms.push(filters.category.toLowerCase());
  if (filters.color) terms.push(filters.color.toLowerCase());
  if (filters.occasion) terms.push(filters.occasion.toLowerCase());
  
  if (userProfile.preferredStyle) {
    const styleTerms = {
      'Casual': ['casual', 'comfortable'],
      'Business': ['professional', 'business'],
      'Formal': ['formal', 'elegant'],
      'Bohemian': ['boho', 'bohemian'],
      'Minimalist': ['minimalist', 'simple'],
      'Trendy': ['trendy', 'fashion'],
      'Classic': ['classic', 'timeless']
    };
    
    const styleSpecificTerms = styleTerms[userProfile.preferredStyle] || [];
    terms.push(...styleSpecificTerms);
  }
  
  return terms.length > 0 ? terms : ['fashion', 'clothing'];
}

function rankProductsForUser(products, userProfile) {
  return products.map(product => {
    let score = 0;
    
    if (product.price >= 20 && product.price <= 100) score += 2;
    else if (product.price < 20) score += 1;
    
    if (product.rating) score += product.rating;
    
    if (product.source === 'eBay') score += 1;
    
    if (userProfile.preferredStyle && 
        product.name.toLowerCase().includes(userProfile.preferredStyle.toLowerCase())) {
      score += 2;
    }
    
    return { ...product, relevanceScore: score };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function getFallbackMarketplaceItems() {
  return [
    {
      id: 'fallback_1',
      name: 'Classic White Button-Down Shirt',
      price: 49.99,
      imageUrl: 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=600',
      url: 'https://www.ebay.com/sch/i.html?_nkw=white+button+shirt',
      source: 'eBay',
      brand: 'StyleCo',
      category: 'Tops',
      rating: 4.2
    }
  ];
}