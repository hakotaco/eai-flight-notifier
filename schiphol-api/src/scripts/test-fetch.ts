import { SchipholService } from "../services/SchipholService";

async function run() {
  const service = new SchipholService();
  try {
    const flights = await service.fetchFlights();
    console.log("===============================");
    console.log("Sample Flight Data (First Record):");
    console.log(JSON.stringify(flights[0], null, 2));
    console.log("===============================");
  } catch (error) {
    console.error("Failed to fetch flights", error);
  }
}

run();
