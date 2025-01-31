'use client'; // Mark as client component

import { useState } from 'react';
import { Modal } from './components/Modal'; // Assuming Modal is a separate component
import { getData, postData } from './utils/crudData';
import { Section, EventDetails } from './interfaces/eventDetails';

const urlRegex = /^https:\/\/www\.ticketmaster\.com\/[a-zA-Z0-9-]+\/event\/[a-zA-Z0-9-]+$/;

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [url, setUrl] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isValid, setIsValid] = useState(true);
  let stopFetching = false;
  
  // Event data state
  const [eventData, setEventData] = useState<EventDetails | null>(null);

  // Event handler for form submission
  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlRegex.test(url)){
      setModalMessage("Ticketmaster URL tidak valid.");
      setIsModalOpen(true);
      return;
    }
    if (accessCode == ""){
      setModalMessage("Access code wajib diisi.");
      setIsModalOpen(true);
      return;
    }
    try {
      await handleShowEventData();
      return;
    } catch (error) {
      setIsLoading(false);
      setModalMessage("Error: " + error);
      setIsModalOpen(true);
      return;
    }
  };

  // Handle URL input change
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
    setIsValid(urlRegex.test(event.target.value));
    setIsValid(event.target.value !== "");
  };

  // Handle Access Code input change
  const handleAccessCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAccessCode(event.target.value);
    setIsValid(event.target.value !== "");
  };

  const startFetching = async (hostUrl: string, taskId: string) => {
    if (stopFetching) return; // Stop if the flag is set to true
    const statusData = await getData(hostUrl + "/status/" + taskId);
    console.log("Status Data: ", statusData);
    switch (statusData.status) {
      case 'scraped':
        console.log("Status Data Result: ", statusData.result);
        const eventData = await getData(hostUrl + "/result/" + statusData.result.result_file);
        setEventData(eventData);
        setIsLoading(false);
        setModalMessage(statusData.message);
        setIsModalOpen(true);
        stopFetching = true;
        break;
      case 'error':
        setIsLoading(false);
        setModalMessage(statusData.message);
        setIsModalOpen(true);
        stopFetching = true;
        break;
    }
    // Set timeout for the next fetch after 10 seconds
    setTimeout(() => startFetching(hostUrl, taskId), 10000) // Recursive call to fetch data again
  };

  // Simulate showing event data
  const handleShowEventData = async () => {
    setIsLoading(true);
    const hostUrl = "https://home.automasterticket.com/api";
    const result = await postData(hostUrl + "/scrape", { "url": url, "code": accessCode });
    console.log("Result Status: ", result.status);
    console.log("Result Task ID: ", result.task_id);
    switch (result.status) {
      case 'pending':
        startFetching(hostUrl, result.task_id);
        break;
      case 'success':
        setIsLoading(false);
        setModalMessage(result.message);
        setIsModalOpen(true);
        const eventData = await getData(hostUrl + "/result/" + result.result_file);
        setEventData(eventData);
        break;
      case 'error':
        setIsLoading(false);
        setModalMessage(result.message);
        setIsModalOpen(true);
        break;
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-black">
      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex justify-center items-center bg-gray-500 bg-opacity-50 z-1000">
          <div className="w-16 h-16 border-4 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      )}

      {/* Form and Event Data */}
      {!isLoading && (
        <div className="w-full max-w-4xl min-h-[80vh] p-6 my-10 bg-white shadow-lg rounded-lg border border-gray-300 flex flex-col">
          <h2 className="text-6xl font-bold mb-4 text-center font-serif">YEFTA</h2>

          <form onSubmit={handleFormSubmit}>
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4 mb-4">
              <input
                type="text"
                className="border-2 border-gray-300 p-2 rounded w-full mb-4 sm:mb-0"
                value={url}
                onChange={handleUrlChange}
                placeholder="Enter a Ticketmaster URL"
              />
              <input
                type="text"
                className="border-2 border-gray-300 p-2 rounded w-auto mb-4 sm:mb-0"
                value={accessCode}
                onChange={handleAccessCodeChange}
                placeholder="Enter a Access Code"
              />
              <button
                type="submit"
                className={`bg-blue-500 text-white font-bold py-2 border-solid border-blue-700 border-2 px-4 min-w-[150px] rounded w-full sm:w-auto ${!isValid ? 'bg-red-500 border-red-700' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? 'LOADING...' : 'GET DATA'}
              </button>
            </div>
          </form>

          {/* Event Data Display */}
          {eventData && (
            <div className="mt-6">
              <h3 className="text-xl font-bold">Event:</h3>
              <p>{eventData.title}</p>

              <h3 className="text-xl font-bold mt-4">Diselenggarakan pada:</h3>
              <p>{eventData.held_on}</p>

              <h3 className="text-xl font-bold mt-4">Lokasi:</h3>
              <p>{eventData.location}</p>

              <h3 className="text-xl font-bold mt-4">Jumlah Section & Row Tersedia:</h3>
              <p>
                {eventData.count.section} Section,{" "}
                {eventData.count.row} Row
              </p>

              <h3 className="text-xl font-bold mt-4">Pilihan Rekomendasi:</h3>
              <ul className="list-disc pl-5">
                {eventData.recommendations.map((recommendation: string, index: number) => (
                  <li key={index}>{recommendation}</li>
                ))}
              </ul>

              <h3 className="text-xl font-bold mt-4">Detail List All Section, Row dan Harga:</h3>
              <ul className="list-disc pl-5">
                {Object.entries(eventData.sections).map(([sectionNumber, sectionData]) => {
                  const section = sectionData as Section; // Type assertion to narrow the type
                  return (
                    <div key={sectionNumber}>
                      {section.rows.map((row, rowIndex) => (
                        <li key={`${sectionNumber}-${rowIndex}`}>
                          Section: {sectionNumber} | Row: {row.row} | Harga: {section.currency} {row.price}
                        </li>
                      ))}
                    </div>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modal for invalid URL */}
      {isModalOpen && <Modal message={modalMessage} onClose={closeModal} />}
    </div>
  );
}
