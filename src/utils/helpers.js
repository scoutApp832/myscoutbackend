/**
 * Generate random string
 */
const generateRandomString = (length = 10) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

/**
 * Format date
 */
const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  const replacements = {
    'YYYY': year,
    'MM': month,
    'DD': day,
    'HH': hours,
    'mm': minutes
  };
  
  let result = format;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(key, value);
  }
  return result;
};

/**
 * Calculate age from birth date
 */
const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Get age group
 */
const getAgeGroup = (age) => {
  if (age <= 12) return '6-12';
  if (age <= 18) return '13-18';
  if (age <= 25) return '19-25';
  return '25+';
};

/**
 * Paginate results
 */
const paginate = (data, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedData = data.slice(startIndex, endIndex);
  
  return {
    data: paginatedData,
    page,
    limit,
    total: data.length,
    totalPages: Math.ceil(data.length / limit)
  };
};

/**
 * Filter by search term
 */
const searchFilter = (items, searchTerm, fields) => {
  if (!searchTerm) return items;
  const term = searchTerm.toLowerCase();
  return items.filter(item => {
    return fields.some(field => {
      const value = item[field]?.toString().toLowerCase() || '';
      return value.includes(term);
    });
  });
};

module.exports = {
  generateRandomString,
  formatDate,
  calculateAge,
  getAgeGroup,
  paginate,
  searchFilter
};