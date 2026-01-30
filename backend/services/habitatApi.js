const fetch = require('node-fetch');

const HABITAT_API_TIMEOUT = parseInt(process.env.HABITAT_API_TIMEOUT) || 5000;

const makeRequest = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HABITAT_API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    return { success: false, error: error.message };
  }
};

const claim = async (apiToken, apiUrl, repoId, commitHash) => {
  const url = `${apiUrl}/api/claim`;
  
  const result = await makeRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      repo_id: repoId,
      commit_hash: commitHash
    })
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    reservationId: result.data.reservation_id,
    expiresAt: result.data.expires_at ? new Date(result.data.expires_at) : null
  };
};

const deleteReservation = async (apiToken, apiUrl, reservationId) => {
  const url = `${apiUrl}/api/reservations/${reservationId}`;
  
  const result = await makeRequest(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiToken}`
    }
  });

  return result;
};

const getUnavailableCommits = async (apiToken, apiUrl, repoId) => {
  const url = `${apiUrl}/api/repos/${repoId}/unavailable-commits`;
  
  const result = await makeRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`
    }
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    commits: result.data.commits || []
  };
};

const getMyReservations = async (apiToken, apiUrl) => {
  const url = `${apiUrl}/api/my-reservations`;
  
  const result = await makeRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`
    }
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    reservations: result.data.reservations || []
  };
};

module.exports = {
  claim,
  deleteReservation,
  getUnavailableCommits,
  getMyReservations
};
