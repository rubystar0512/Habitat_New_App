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
  // Use the correct endpoint: /api/v1/commit-reservations/claim
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/commit-reservations/claim`;
  
  const result = await makeRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'HabitateWeb/1.0'
    },
    body: JSON.stringify({
      repository_id: repoId, // Use repository_id, not repo_id
      commit_hash: commitHash
    })
  });

  if (!result.success) {
    // Handle 409 (already reserved) as a special case
    if (result.error && result.error.includes('409')) {
      return {
        success: false,
        error: 'Commit already reserved by another user',
        alreadyReserved: true
      };
    }
    return result;
  }

  // Handle response format - check for id or reservation_id
  const reservationId = result.data?.id || result.data?.reservation_id;
  const expiresAt = result.data?.expires_at ? new Date(result.data.expires_at) : null;

  return {
    success: true,
    reservationId: reservationId,
    expiresAt: expiresAt
  };
};

const deleteReservation = async (apiToken, apiUrl, reservationId) => {
  // Use the correct endpoint: /api/v1/commit-reservations/{id}
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/commit-reservations/${reservationId}`;
  
  const result = await makeRequest(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'HabitateWeb/1.0'
    }
  });

  return result;
};

const getUnavailableCommits = async (apiToken, apiUrl, repoId) => {
  // Use the correct endpoint: /api/v1/code/repos/{id}/unavailable-commits
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/code/repos/${repoId}/unavailable-commits`;
  
  const result = await makeRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'HabitateWeb/1.0'
    }
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    commits: result.data?.commits || result.data || []
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

const checkAccountHealth = async (apiToken, apiUrl) => {
  // Use the correct endpoint to get reservations
  const url = `${apiUrl}/api/v1/commit-reservations/my-reservations?include_released=false`;
  
  const result = await makeRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`
    }
  });
  
  if (!result.success) {
    return {
      success: false,
      health: 'error',
      error: result.error
    };
  }

  // Handle different response formats
  const reservations = result.data?.reservations || result.data || [];
  const activeReservations = reservations.filter(r => {
    // Filter active reservations (not released/expired)
    return r.status === 'reserved' || r.status === 'active' || (!r.released && !r.expired);
  }).length;
  
  return {
    success: true,
    activeReservations,
    totalReservations: reservations.length
  };
};

module.exports = {
  claim,
  deleteReservation,
  getUnavailableCommits,
  getMyReservations,
  checkAccountHealth
};
