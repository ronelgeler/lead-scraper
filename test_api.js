async function test() {
  const apiKey = "AIzaSyAGZdZUyczQdQF5w4MLl_Hot_0hX3BIiuQ";
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=plumber+in+beersheba&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("Status:", data.status);
  if (data.results && data.results.length > 0) {
      console.log("Found:", data.results.length);
      console.log("First:", data.results[0].name, data.results[0].place_id);
      
      // Test Place Details API
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${data.results[0].place_id}&fields=name,formatted_phone_number,website&key=${apiKey}`;
      const detRes = await fetch(detailsUrl);
      const detData = await detRes.json();
      console.log("Details Status:", detData.status);
      console.log("Details:", detData.result);
  } else {
      console.log(data);
  }
}
test();
