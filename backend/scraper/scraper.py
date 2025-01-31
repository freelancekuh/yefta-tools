from playwright.async_api import async_playwright
from .session_manager import SessionManager
from .helpers import detect_and_click_button, process_result_data, count_execution_time
from .ticket_data import extract_ticket_data, save_or_update_file
import random
import time

async def scrape_with_session(url=None, session_name="default_session", output_filename=None):
    if url == None:
        raise ValueError("URL cannot be None.")
    if output_filename == None:
        raise ValueError("Output filename cannot be None.")
    domain = ".ca" if ".ca" in url else ".com"
    request_detected = False

    async with async_playwright() as p:
        print("Opening browser...")
        browser = await p.firefox.launch(headless=True)
        print("Checking existing session...")
        session_manager = SessionManager()
        if await session_manager.is_session_valid(session_name):
            print("Session valid founded, using existing session...")
            context = await browser.new_context(storage_state=session_manager.get_session_path(session_name))
        else:
            print("Session valid not found, generate new session...")
            context = await browser.new_context()
        page = await context.new_page()

        try:
            print(f"Accessing {url}")
            print("Waiting for first load...")
            await page.goto(url, wait_until='load', timeout=0)
            print("Detected Title:", await page.title())
            print("Delay prewaiting to second load...")
            await page.wait_for_timeout(10000)
            print("Detected Title:", await page.title())
            print("Waiting for second load...")
            await page.wait_for_load_state('load', timeout=0)
            print("Detected Title:", await page.title())
            print("Page loaded successfully, begin scraping...")
            await detect_and_click_button(page, xpath_selector='//*[@id="modalContent"]/div[3]/div/button/span/span', description="Accept & Continue", optional=True, timeout=7000)
            if not await session_manager.is_session_valid(session_name):
                print("Session not valid or doesn't exist, saving new session...")
                await session_manager.save_session(context, session_name)
                print("New session has been saved...")
            
            async def specific_endpoint_request_handler(response):
                """Detect request and handle the response"""
                # Access request_detected variable outside function
                nonlocal request_detected
                # Detect specific endpoint request in response url after click best seats or perform scrolling
                specific_endpoint = f"services.ticketmaster{domain}/api/ismds/event" if domain == ".ca" else f"services.ticketmaster.com/api/ismds/event"
                if specific_endpoint in response.url:
                    print(f"Request API detected: {response.url}")
                    print(f"Status: {response.status}")
                    request_detected = True

            # Detect and click the 'Best Seats' button if it appears
            await detect_and_click_button(page, xpath_selector='span[data-bdd="quick-picks-sort-button-best"]', description="Best Seats")

            # Wait vip star row visible
            await page.wait_for_selector('div[data-bdd="merch-slot-title-vip-star"]', state='visible')

            page.on('response', specific_endpoint_request_handler)

            async def prevent_upward_scroll(page):
                await page.evaluate("""
                    window.addEventListener('wheel', function(event) {
                        if (event.deltaY < 0) {  // Check if the scroll direction is upwards
                            event.preventDefault();  // Prevent the scroll
                        }
                    }, { passive: false });
                """)

            async def press_end_button(page):
                await page.keyboard.press('End')
            
            async def perform_random_wait(page, description, timeout=None):
                wait_time = random.randint(500, 1500) # generate random number (in second) for waiting time
                if timeout != None:
                    wait_time = timeout
                print(f"Waiting for {wait_time/1000} seconds for {description}...")
                await page.wait_for_timeout(wait_time)
            
            max_scroll_attempts = 50
            scroll_attempts = 0

            await prevent_upward_scroll(page)
            while scroll_attempts < max_scroll_attempts:
                start_time = time.time()
                request_detected = False
                retry_count = 0
                max_retries = 4

                while not request_detected and retry_count < max_retries:
                    try:
                        if scroll_attempts == 0 and retry_count == 0:
                            await perform_random_wait(page, 'Readiness list ticket data')

                        print(f"\nScroll attempt: {scroll_attempts + 1}, Retry: {retry_count + 1}")
                        print(f"Pressing end button...")
                        await press_end_button(page)
                        await perform_random_wait(page, 'API Response', timeout=1000*(retry_count+1))
                        
                        if request_detected:
                            await perform_random_wait(page, 'Calming Down after request detected', timeout=random.randint(2500, 4000))
                            break

                        retry_count += 1
                        if retry_count < max_retries:
                            print(f"No request detected, retrying... ({retry_count}/{max_retries})")
                        
                    except Exception as e:
                        print(f"Warning during scroll attempt: {str(e)}")
                        break
                
                if scroll_attempts < 5 and retry_count == 4:
                    # Detect and click the 'Best Seats' button if it appears
                    await detect_and_click_button(page, xpath_selector='span[data-bdd="quick-picks-sort-button-best"]', description="Best Seats")
                    # Wait vip star row visible
                    await page.wait_for_selector('div[data-bdd="merch-slot-title-vip-star"]', state='visible')

                if not request_detected:
                    print("No API request detected after maximum retries, stopping...")
                    break
                
                scroll_attempts += 1
                end_time = time.time()
                execution_time = await count_execution_time(start_time, end_time)
                print(f"Execution time for scroll atempt {scroll_attempts + 1} is {execution_time}.")
            
            all_ticket_data = await extract_ticket_data(page)
            await save_or_update_file(url, page, all_ticket_data, output_filename)
            await process_result_data(output_filename)
        except Exception as e:
            print(f"Error during scraping: {str(e)}")
        finally:
            await browser.close()
