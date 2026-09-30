const fs = require('fs');
const API_KEY = "AIzaSyAGZdZUyczQdQF5w4MLl_Hot_0hX3BIiuQ";

async function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function scrapeGoogleMaps(query) {
    console.log(`Searching Google Maps for: "${query}"...`);
    let results = [];
    let nextPageToken = null;
    
    do {
        let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}&language=iw`;
        if (nextPageToken) {
            url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${API_KEY}&language=iw`;
        }
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
                if (data.results) {
                    results = results.concat(data.results);
                }
                nextPageToken = data.next_page_token;
                if (nextPageToken) {
                    console.log("Waiting 2.5 seconds for next page token to become valid...");
                    await delay(2500); // Google requires a delay
                }
            } else {
                console.error("Error from Text Search API:", data.status, data.error_message);
                break;
            }
        } catch (e) {
            console.error("Fetch error:", e.message);
            break;
        }
    } while (nextPageToken);
    
    console.log(`Found ${results.length} total businesses. Fetching details to check websites...`);
    
    const leads = [];
    const chunkSize = 5;
    for (let i = 0; i < results.length; i += chunkSize) {
        const chunk = results.slice(i, i + chunkSize);
        const chunkPromises = chunk.map(async (place) => {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,website,formatted_address&key=${API_KEY}&language=iw`;
            try {
                const detRes = await fetch(detailsUrl);
                const detData = await detRes.json();
                if (detData.status === 'OK') {
                    const details = detData.result;
                    // Strict filter: has a phone AND has NO website AND phone starts with 05
                    if (details.formatted_phone_number && !details.website) {
                        return {
                            name: details.name,
                            phone: details.formatted_phone_number,
                            address: details.formatted_address || "Unknown"
                        };
                    }
                }
            } catch (e) { }
            return null;
        });
        
        const chunkResults = await Promise.all(chunkPromises);
        chunkResults.forEach(lead => {
            if (lead) leads.push(lead);
        });
    }
    
    console.log("\n=== QUALIFIED LEADS (No Website) ===");
    console.table(leads);
    fs.writeFileSync('leads.json', JSON.stringify(leads, null, 2));
    console.log(`Saved ${leads.length} leads to leads.json`);
}

const query = process.argv[2] || "אינסטלטור באר שבע";
scrapeGoogleMaps(query);
