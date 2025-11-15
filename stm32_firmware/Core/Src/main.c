/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2025 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */
/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include "adc.h"
#include "dma.h"
#include "i2c.h"
#include "usart.h"
#include "gpio.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include "i2c-lcd.h"
#include "stdio.h"
#include "string.h"
#include "math.h"
#include "stdlib.h"
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */
const int B_CONST = 4275;
const float R0_CONST = 100000.0;
const float ADC_MAX = 4095.0;
#define RX_BUF_SIZE 100
/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/

/* USER CODE BEGIN PV */
uint16_t adc_buf[4];
char tx_buf[100];
uint8_t rx_char;
uint8_t rx_buf[RX_BUF_SIZE];
volatile int rx_idx = 0;
volatile uint8_t command_ready_flag = 0;
uint32_t lastSendTime = 0;
const uint32_t sendInterval = 100;
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
/* USER CODE BEGIN PFP */
void sendSensorData(void);
void parseCommand(char *cmd);
/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */

/* USER CODE END 0 */

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{

  /* USER CODE BEGIN 1 */

  /* USER CODE END 1 */

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_DMA_Init();
  MX_USART2_UART_Init();
  MX_ADC1_Init();
  MX_I2C1_Init();
  /* USER CODE BEGIN 2 */
  (void)HAL_I2C_GetState(&hi2c1);

  lcd_init(&hi2c1);
  lcd_set_rgb(0, 100, 255);
  lcd_set_cursor(0, 0);
  lcd_send_string("System Online.");
  lcd_set_cursor(0, 1);
  lcd_send_string("Waiting for PC...");

  if (HAL_ADC_Start_DMA(&hadc1, (uint32_t*)adc_buf, 4) != HAL_OK)
  {
	  Error_Handler();
  }

  if (HAL_UART_Receive_IT(&huart2, &rx_char, 1) != HAL_OK)
  {
	  Error_Handler();
  }
  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
	uint32_t now = HAL_GetTick();
	if (now - lastSendTime >= sendInterval)
	{
		lastSendTime = now;
		sendSensorData();
	}

	if (command_ready_flag)
	{
		parseCommand((char*)rx_buf);
		rx_idx = 0;
		memset(rx_buf, 0, RX_BUF_SIZE);
		command_ready_flag = 0;
	}
  }
  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  /** Configure the main internal regulator output voltage
  */
  __HAL_RCC_PWR_CLK_ENABLE();
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE2);

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSI;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSI;
  RCC_OscInitStruct.PLL.PLLM = 16;
  RCC_OscInitStruct.PLL.PLLN = 336;
  RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV4;
  RCC_OscInitStruct.PLL.PLLQ = 7;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_2) != HAL_OK)
  {
    Error_Handler();
  }
}

/* USER CODE BEGIN 4 */
void sendSensorData(void)
{
	uint16_t temp_adc_val = adc_buf[0];
	uint16_t accel_x_val = adc_buf[1];
	uint16_t accel_y_val = adc_buf[2];
	uint16_t accel_z_val = adc_buf[3];

	float temp_C = -99.0;
	if (temp_adc_val > 0)
	{
		float R_thermistor = R0_CONST * (ADC_MAX / (float)temp_adc_val - 1.0);
		float log_R = log(R_thermistor / R0_CONST);
		float temp_K = 1.0 / (log_R / B_CONST + 1.0 / 298.15);
		temp_C = temp_K - 273.15;
	}

	int len = sprintf(tx_buf, "Temp:%.1f,X:%u,Y:%u,Z:%u\n",
	                    temp_C,
	                    accel_x_val,
	                    accel_y_val,
	                    accel_z_val);
	HAL_UART_Transmit(&huart2, (uint8_t*)tx_buf, len, 100);
}

void parseCommand(char *cmd)
{
	if (strncmp(cmd, "B:", 2) == 0)
	{
		int val = atoi(cmd + 2);
		if (val == 1)
		{
			HAL_GPIO_WritePin(Buzzer_PIN_GPIO_Port, Buzzer_PIN_Pin, GPIO_PIN_SET);
		}
		else
		{
			HAL_GPIO_WritePin(Buzzer_PIN_GPIO_Port, Buzzer_PIN_Pin, GPIO_PIN_RESET);
		}
	}

	if (strncmp(cmd, "L:", 2) == 0)
	{
		char *msg = cmd + 2;
		char *saveptr;
		char *line1 = strtok_r(msg, "|", &saveptr);
		char *line2 = strtok_r(NULL, "|", &saveptr);

		lcd_clear();
		lcd_set_cursor(0, 0);
		if (line1)
		{
			lcd_send_string(line1);
		}
		if (line2)
		{
			lcd_set_cursor(0, 1);
			lcd_send_string(line2);
		}
	}
}

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
	if (huart->Instance == USART2)
	{
		if (rx_char == '\n' || rx_char == '\r')
		{
			if (rx_idx > 0)
			{
				rx_buf[rx_idx] = '\0';
				command_ready_flag = 1;
			}
		}
		else
		{
			if (rx_idx < RX_BUF_SIZE - 1)
			{
				rx_buf[rx_idx++] = rx_char;
			}
		}
		HAL_UART_Receive_IT(&huart2, &rx_char, 1);
	}
}
/* USER CODE END 4 */

/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
  /* USER CODE BEGIN Error_Handler_Debug */
  /* User can add his own implementation to report the HAL error return state */
  __disable_irq();
  while (1)
  {
	  HAL_GPIO_TogglePin(LD2_GPIO_Port, LD2_Pin);
	  HAL_Delay(50);
  }
  /* USER CODE END Error_Handler_Debug */
}
#ifdef USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
     ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */
